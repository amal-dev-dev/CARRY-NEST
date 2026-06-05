import  Product from  "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Review from "../../Model/reviewModel.js";


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

        // Price

        if (price) {

            const [min, max] = price.split("-");

            query.salePrice = {
                $gte: Number(min),
                $lte: Number(max)
            };

        }

        // Sorting

        let sortOption = {};

        switch (sort) {

            case "low-high":
                sortOption.salePrice = 1;
                break;

            case "high-low":
                sortOption.salePrice = -1;
                break;

            case "a-z":
                sortOption.productName = 1;
                break;

            case "z-a":
                sortOption.productName = -1;
                break;
        }

        const totalProducts = await Product.countDocuments(query);

        const products = await Product.find(query)
            .populate("category")
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find();

        res.render("user/products", {

            products,
            categories,

            currentPage: page,
            totalPages,

            search,
            category,
            brand,
            price,
            sort

        });

    } catch (error) {

        console.log(error);

    }

};

const loadProductDetails = async(req,res)=>{

    try{

        const id = req.params.id;

        const product = await Product
        .findById(id)
        .populate("category");

        if(!product || product.isBlocked){

            return res.redirect(
                "/user/products"
            );

        }

        const relatedProducts = await Product.find({

            category:product.category,

            isBlocked:false,

            _id:{
                $ne:product._id
            }

        }).limit(4);

        // Get Reviews

        const reviews = await Review.find({

            variantId:product._id

        }).populate("userId");

        // Calculate Average Rating

        const averageRating = reviews.length ? reviews.reduce( (sum,review)=> sum + review.rating, 0 ) / reviews.length :0;

        const discountPercentage = product.regularPrice > 0 ? Math.round(( product.regularPrice - product.salePrice ) / product.regularPrice * 100 ): 0;

        res.render("user/product-details", {
                product,
                relatedProducts,
                reviews,
                averageRating,
                discountPercentage
            }
        );

    }catch(error){

        console.log(
            "PRODUCT DETAILS ERROR:",
            error
        );

        res.redirect(
            "/user/pageNotFound"
        );

    }

};


export default {
    loadProducts,
    loadProductDetails
}