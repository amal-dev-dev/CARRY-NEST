import Product from  "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Review from "../../Model/reviewModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";
import Offer from "../../Model/offerModel.js";
import Brand from "../../Model/brandModel.js";


const loadProducts = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = 8;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const category = req.query.category || "";
        const brand = req.query.brand || "";
        const color = req.query.color || "";
        const price = req.query.price || "";
        const sort = req.query.sort || "";
        const message = req.query.message || "";

        // Get only active/listed categories
        const activeCategoryIds = await Category.find({
            isListed: true,
            isBlocked: { $ne: true }
        }).distinct("_id");

        // Exclude blocked products and products from blocked categories
        let query = {
            isBlocked: false,
            category: { $in: activeCategoryIds }
        };

        // Search
        if (search) {
            query.productName = {
                $regex: search,
                $options: "i"
            };
        }

        // Category filter
        if (category) {

            let selectedCategory = null;

            // Check whether category is a MongoDB ObjectId
            if (/^[0-9a-fA-F]{24}$/.test(category)) {

                selectedCategory = await Category.findOne({
                    _id: category,
                    isListed: true,
                    isBlocked: { $ne: true }
                });

            } else {

                // Support category name URLs also
                selectedCategory = await Category.findOne({
                    name: category,
                    isListed: true,
                    isBlocked: { $ne: true }
                });

            }

            if (selectedCategory) {
                query.category = selectedCategory._id;
            } else {
                // No products for invalid or unavailable category
                query.category = { $in: [] };
            }
        }


        // Brand filter
        if (brand) {
            query.brand = brand;
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

        // Count only products that match all filters
        const totalProducts = await Product.countDocuments(query);

        const products = await Product.find(query)
            .populate("category")
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({
            isListed: true,
            isBlocked: { $ne: true }
        });

        const brands = await Brand.find({
            isActive: true
        }).sort({ name: 1 }).lean();


        let wishlistProductIds = [];

        if (req.session.user) {
            const wishlist = await Wishlist.findOne({
                userId: req.session.user
            }).lean();

            if (wishlist) {
                wishlistProductIds = wishlist.items.map(item =>
                    item.productId.toString()
                );
            }
        }

        return res.render("user/products", {
            products,
            message,
            categories,
            brands,
            currentPage: page,
            totalPages,
            search,
            category,
            brand,
            color,
            price,
            sort,
            wishlistProductIds,
            user: req.session.user || null
        });

    } catch (error) {
        console.log("LOAD PRODUCTS ERROR:", error);
        return res.status(500).send("Unable to load products");
    }
};


const loadProductDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.user;
        const productId = req.params.id;

        const product = await Product.findById(id).populate("category");

        if (
            !product ||
            product.isBlocked ||
            !product.category ||
            product.category.isListed !== true ||
            product.category.isBlocked === true
        ) {
            return res.redirect(
                "/user/products?message=Product%20is%20currently%20unavailable"
            );
        }

        // only valid variants
        const filteredVariants = product.variants.filter(variant =>
            variant &&
            variant.size &&
            variant.size.trim() !== "" &&
            variant.salePrice != null
        );

        const defaultVariant = filteredVariants.length > 0 ? filteredVariants[0] : null;

        // Find active offers
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

        // Find offers applicable to this product
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

        // Choose the highest discount percentage
        const appliedOffer = applicableOffers.reduce(
            (best, current) => {
                if (
                    !best ||
                    current.discountPercentage > best.discountPercentage
                ) {
                    return current;
                }

                return best;
            },
            null
        );

        const offerDiscountPercentage =
            appliedOffer?.discountPercentage || 0;

        // Calculate offer price for the default variant
        const basePrice = Number(
            defaultVariant?.salePrice ?? 0
        );

        const offerPrice = Math.round(
            basePrice * (1 - offerDiscountPercentage / 100)
        );

        let wishlistExists = false;

        if (userId) {
            const wishlist = await Wishlist.findOne({ userId });

            if (wishlist && wishlist.items && wishlist.items.length > 0) {
                wishlistExists = wishlist.items.some(
                    item => item.productId.toString() === id.toString()
                );
            }
        }

        // cart count
        let cartCount = 0;

        if (userId) {
            const cart = await Cart.findOne({ userId });
            if (cart) {
                cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        }

        const relatedProducts = await Product.find({
            category: product.category,
            isBlocked: false,
            _id: { $ne: product._id }
        }).limit(4);

        const reviews = await Review.find({ productId })
            .populate("userId", "name")
            .sort({ createdAt: -1 })
            .lean();

        const averageRating =
            reviews.length > 0
                ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
                : 0;

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

        res.render("user/product-details", {
            product,
            filteredVariants,
            defaultVariant,
            wishlistExists,
            relatedProducts,
            reviews,
            averageRating,
            discountPercentage,
            cartCount,
            user: userId || null,
            offerPrice,
            offerDiscountPercentage,
            appliedOffer,
        });

    } catch (error) {
        console.log("PRODUCT DETAILS ERROR:", error);
        res.redirect("/user/pageNotFound");
    }
};


export default {
    loadProducts,
    loadProductDetails
}