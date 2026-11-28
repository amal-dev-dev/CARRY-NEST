
import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Brand from "../../Model/brandModel.js";
import Review from "../../Model/reviewModel.js";
import Cart from "../../Model/cartModel.js";
import Offer from "../../Model/offerModel.js";


const getProductsPageData = async ({
    page = 1,
    limit = 8,
    search = "",
    category = "",
    brand = "",
    color = "",
    price = "",
    sort = "",
    userId = null
}) => {
    page = Math.max(1, Number(page) || 1);

    const skip = (page - 1) * limit;

    // Get active categories
    const activeCategoryIds = await Category.find({
        isListed: true,
        isBlocked: { $ne: true }
    }).distinct("_id");

    // Get active brand names
    const activeBrandNames = await Brand.find({
        isActive: true
    }).distinct("name");

    // Base product query
    const query = {
        isBlocked: false,
        category: { $in: activeCategoryIds },
        brand: { $in: activeBrandNames }
    };

    // Search filter
    if (search) {
        query.productName = {
            $regex: search,
            $options: "i"
        };
    }

    // Category filter
    if (category) {
        let selectedCategory = null;

        if (/^[0-9a-fA-F]{24}$/.test(category)) {
            selectedCategory = await Category.findOne({
                _id: category,
                isListed: true,
                isBlocked: { $ne: true }
            });
        } else {
            selectedCategory = await Category.findOne({
                name: category,
                isListed: true,
                isBlocked: { $ne: true }
            });
        }

        if (selectedCategory) {
            query.category = selectedCategory._id;
        } else {
            query.category = { $in: [] };
        }
    }

    // Brand filter
    if (brand) {
        query.brand = {
            $in: activeBrandNames,
            $eq: brand
        };
    }

    // Color filter
    if (color) {
        query.colors = {
            $regex: `^${color}$`,
            $options: "i"
        };
    }

    // Price filter
    if (price) {
        const [min, max] = price.split("-");
        const priceQuery = {};

        if (min !== "") {
            priceQuery.$gte = Number(min);
        }

        if (max !== undefined && max !== "") {
            priceQuery.$lte = Number(max);
        }

        query["variants.0.salePrice"] = priceQuery;
    }

    // Sorting
    let sortOption = {};

    switch (sort) {
        case "oldest":
            sortOption = { createdAt: 1 };
            break;

        case "low-high":
            sortOption = { "variants.0.salePrice": 1 };
            break;

        case "high-low":
            sortOption = { "variants.0.salePrice": -1 };
            break;

        case "a-z":
            sortOption = { productName: 1 };
            break;

        case "z-a":
            sortOption = { productName: -1 };
            break;

        default:
            sortOption = { createdAt: -1 };
    }

    // Get total matching products
    const totalProducts = await Product.countDocuments(query);

    // Get products
    const products = await Product.find(query)
        .populate("category")
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

    const totalPages = Math.ceil(totalProducts / limit);

    // Get active categories for filters
    const categories = await Category.find({
        isListed: true,
        isBlocked: { $ne: true }
    });

    // Get active brands
    const brands = await Brand.find({
        isActive: true
    })
        .sort({ name: 1 })
        .lean();

    // Get wishlist products
    let wishlistProductIds = [];

    if (userId) {
        const wishlist = await Wishlist.findOne({
            userId
        }).lean();

        if (wishlist) {
            wishlistProductIds = wishlist.items.map(item =>
                item.productId.toString()
            );
        }
    }

    return {
        products,
        categories,
        brands,
        currentPage: page,
        totalPages,
        wishlistProductIds
    };
};



const getProductDetailsPageData = async (productId, userId = null) => {

    // 1. Find product and populate category
    const product = await Product.findById(productId)
        .populate("category");

    if (
        !product ||
        product.isBlocked ||
        !product.category ||
        product.category.isListed !== true ||
        product.category.isBlocked === true
    ) {
        return null;
    }

    // Check active brands
    const activeBrandNames = await Brand.find({
        isActive: true
    }).distinct("name");

    // Check whether product belongs to an active brand
    if (!activeBrandNames.includes(product.brand)) {
        return null;
    }

    // 2. Filter valid variants
    const filteredVariants = product.variants.filter(variant =>
        variant &&
        variant.size &&
        variant.size.trim() !== "" &&
        variant.salePrice != null
    );

    const defaultVariant =
        filteredVariants.length > 0
            ? filteredVariants[0]
            : null;

    // 3. Get active offers
    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const activeOffers = await Offer.find({
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: today }
    })
        .populate("productId", "_id")
        .populate("categoryId", "_id")
        .lean();

    // 4. Find offers applicable to this product
    const applicableOffers = activeOffers.filter(offer => {

        if (offer.offerType === "product") {
            return (
                String(offer.productId?._id) ===
                String(product._id)
            );
        }

        if (offer.offerType === "category") {
            return (
                String(offer.categoryId?._id) ===
                String(product.category?._id)
            );
        }

        return false;
    });

    // 5. Select highest discount offer
    const appliedOffer = applicableOffers.reduce(
        (best, current) => {

            if (
                !best ||
                current.discountPercentage >
                best.discountPercentage
            ) {
                return current;
            }

            return best;
        },
        null
    );

    const offerDiscountPercentage =
        appliedOffer?.discountPercentage || 0;

    // 6. Calculate offer price
    const basePrice = Number(
        defaultVariant?.salePrice ?? 0
    );

    const offerPrice = Math.round(
        basePrice *
        (1 - offerDiscountPercentage / 100)
    );

    // 7. Check wishlist
    let wishlistExists = false;

    if (userId) {
        const wishlist = await Wishlist.findOne({
            userId
        });

        if (
            wishlist &&
            wishlist.items &&
            wishlist.items.length > 0
        ) {
            wishlistExists = wishlist.items.some(
                item =>
                    item.productId.toString() ===
                    productId.toString()
            );
        }
    }

    // 8. Get cart count
    let cartCount = 0;

    if (userId) {
        const cart = await Cart.findOne({
            userId
        });

        if (cart) {
            cartCount = cart.items.reduce(
                (sum, item) => sum + item.quantity,
                0
            );
        }
    }

    // 9. Get related products
    const relatedProducts = await Product.find({
        category: product.category,
        isBlocked: false,
        brand: { $in: activeBrandNames },
        _id: { $ne: product._id }
    }).limit(4);

    // 10. Get product reviews
    const reviews = await Review.find({
        productId
    })
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .lean();

    // 11. Calculate average rating
    const averageRating =
        reviews.length > 0
            ? reviews.reduce(
                (sum, review) => sum + review.rating,
                0
            ) / reviews.length
            : 0;

    // 12. Calculate discount percentage
    let discountPercentage = 0;

    if (
        defaultVariant?.regularPrice &&
        defaultVariant.regularPrice > 0
    ) {
        discountPercentage = Math.round(
            (
                (defaultVariant.regularPrice - offerPrice) /
                defaultVariant.regularPrice
            ) * 100
        );
    }

    return {
        product,
        filteredVariants,
        defaultVariant,
        wishlistExists,
        relatedProducts,
        reviews,
        averageRating,
        discountPercentage,
        cartCount,
        offerPrice,
        offerDiscountPercentage,
        appliedOffer
    };
};



export default {
    getProductsPageData,
    getProductDetailsPageData
};
