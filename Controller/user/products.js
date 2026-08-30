import  Product from  "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Review from "../../Model/reviewModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";


const loadProducts = async (req, res) => {
    try {

        const page = Number(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const category = req.query.category || "";
        const brand = req.query.brand || "";
        const price = req.query.price || "";
        const sort = req.query.sort || "";
        const message = req.query.message || "";

        let query = {
            isBlocked: false
        };

        // Search
        if (search) {
            query.productName = {
                $regex: search,
                $options: "i"
            };
        }

        // Category
        if (category) {
            query.category = category;
        }

        // Brand
        if (brand) {
            query.brand = brand;
        }

        // Price Filter
        if (price) {

            const [min, max] = price.split("-");

            query["variants.0.salePrice"] = {};

            if (min) {
                query["variants.0.salePrice"].$gte = Number(min);
            }

            if (max) {
                query["variants.0.salePrice"].$lte = Number(max);
            }
        }

        // Sorting
        let sortOption = {};

        switch (sort) {

            case "oldest" :
                sortOption = { createdAt: 1};
                break;

            case "low-high":
                sortOption["variants.0.salePrice"] = 1;
                break;

            case "high-low":
                sortOption["variants.0.salePrice"] = -1;
                break;

            case "a-z":
                sortOption.productName = 1;
                break;

            case "z-a":
                sortOption.productName = -1;
                break;

            default:
                sortOption.createdAt = -1;
        }

        const totalProducts = await Product.countDocuments(query);

        const products = await Product.find(query)
            .populate("category")
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({
            isListed: true
        });

        res.render("user/products", {
            products,
            message,
            categories,
            currentPage: page,
            totalPages,
            search,
            category,
            brand,
            price,
            sort,
            user: req.session.user || null
        });

    } catch (error) {
        console.log("LOAD PRODUCTS ERROR:", error);
    }
};

const loadProductDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.user;

        const product = await Product.findById(id).populate("category");


        if (!product || product.isBlocked) {
            return res.redirect("/user/products?message=Product%20is%20currently%20unavailable");
        }

        // only valid variants
        const filteredVariants = product.variants.filter(variant =>
            variant &&
            variant.size &&
            variant.size.trim() !== "" &&
            variant.salePrice != null
        );

        const defaultVariant = filteredVariants.length > 0 ? filteredVariants[0] : null;

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

        const reviews = await Review.find({
            productId: product._id
        }).populate("userId");

        const averageRating =
            reviews.length > 0
                ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
                : 0;

        let discountPercentage = 0;
        if (
            defaultVariant &&
            defaultVariant.regularPrice &&
            defaultVariant.salePrice &&
            defaultVariant.regularPrice > defaultVariant.salePrice
        ) {
            discountPercentage = Math.round(
                ((defaultVariant.regularPrice - defaultVariant.salePrice) /
                    defaultVariant.regularPrice) *
                    100
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
            user: userId || null
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