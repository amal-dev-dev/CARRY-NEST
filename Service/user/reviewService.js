
import mongoose from "mongoose";
import Review from "../../Model/reviewModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";

// Validate MongoDB ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Validate review input
const validateReviewData = ({ rating, title, comment }) => {
    const numericRating = Number(rating);
    const reviewTitle = String(title || "").trim();
    const reviewComment = String(comment || "").trim();

    if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
    ) {
        return {
            success: false,
            message: "Please select a rating between 1 and 5."
        };
    }

    if (reviewTitle.length < 3 || reviewTitle.length > 100) {
        return {
            success: false,
            message: "Title must contain 3 to 100 characters."
        };
    }

    if (reviewComment.length < 3 || reviewComment.length > 1000) {
        return {
            success: false,
            message: "Review must contain 3 to 1000 characters."
        };
    }

    return {
        success: true,
        data: {
            rating: numericRating,
            title: reviewTitle,
            comment: reviewComment
        }
    };
};

// 1. Get reviews for a product
const getProductReviews = async (productId) => {
    if (!isValidId(productId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid product ID."
        };
    }

    const reviews = await Review.find({ productId })
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .lean();

    const totalReviews = reviews.length;

    const averageRating = totalReviews
        ? Number((
            reviews.reduce((total, review) => total + review.rating, 0)
            / totalReviews
        ).toFixed(1))
        : 0;

    return {
        success: true,
        reviews,
        totalReviews,
        averageRating
    };
};

// 2. Add a review
const createReview = async (userId, productId, orderId, reviewData) => {
    if (!isValidId(productId) || !isValidId(orderId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid order ID or product ID."
        };
    }

    const validation = validateReviewData(reviewData);

    if (!validation.success) {
        return {
            ...validation,
            status: 400
        };
    }

    const deliveredOrder = await Order.findOne({
        _id: orderId,
        userId,
        products: {
            $elemMatch: {
                productId,
                status: "delivered"
            }
        }
    });

    if (!deliveredOrder) {
        return {
            success: false,
            status: 403,
            message: "You can review only products delivered to you."
        };
    }

    const productExists = await Product.exists({ _id: productId });

    if (!productExists) {
        return {
            success: false,
            status: 404,
            message: "Product not found."
        };
    }

    const existingReview = await Review.findOne({
        userId,
        productId
    });

    if (existingReview) {
        return {
            success: false,
            status: 409,
            message: "You have already reviewed this product."
        };
    }

    const review = await Review.create({
        userId,
        productId,
        orderId: deliveredOrder._id,
        ...validation.data
    });

    return {
        success: true,
        review
    };
};

// 3. Edit your own review
const updateReview = async (userId, reviewId, reviewData) => {
    if (!isValidId(reviewId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid review ID."
        };
    }

    const validation = validateReviewData(reviewData);

    if (!validation.success) {
        return {
            ...validation,
            status: 400
        };
    }

    const updatedReview = await Review.findOneAndUpdate(
        {
            _id: reviewId,
            userId
        },
        {
            $set: validation.data
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedReview) {
        return {
            success: false,
            status: 404,
            message: "Review not found or you cannot edit this review."
        };
    }

    return {
        success: true,
        review: updatedReview
    };
};

// 4. Delete your own review
const removeReview = async (userId, reviewId) => {
    if (!isValidId(reviewId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid review ID."
        };
    }

    const review = await Review.findOneAndDelete({
        _id: reviewId,
        userId
    });

    if (!review) {
        return {
            success: false,
            status: 404,
            message: "Review not found or you do not have permission to delete it."
        };
    }

    return {
        success: true
    };
};

// 5. Get review form page data
const getReviewFormData = async (userId, orderId, productId) => {
    if (!isValidId(orderId) || !isValidId(productId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid order or product."
        };
    }

    const order = await Order.findOne({
        _id: orderId,
        userId,
        products: {
            $elemMatch: {
                productId,
                status: "delivered"
            }
        }
    });

    if (!order) {
        return {
            success: false,
            status: 403,
            message: "You can review only products delivered to you."
        };
    }

    const product = await Product.findById(productId);

    if (!product) {
        return {
            success: false,
            status: 404,
            message: "Product not found."
        };
    }

    const existingReview = await Review.findOne({
        userId,
        productId
    });

    if (existingReview) {
        return {
            success: true,
            existingReviewId: existingReview._id
        };
    }

    return {
        success: true,
        order,
        product
    };
};

// 6. Get edit review page data
const getEditReviewPageData = async (userId, reviewId) => {
    if (!isValidId(reviewId)) {
        return {
            success: false,
            status: 400,
            message: "Invalid review ID."
        };
    }

    const review = await Review.findOne({
        _id: reviewId,
        userId
    }).lean();

    if (!review) {
        return {
            success: false,
            status: 404,
            message: "Review not found."
        };
    }

    const product = await Product.findById(review.productId).lean();

    if (!product) {
        return {
            success: false,
            status: 404,
            message: "Product not found."
        };
    }

    return {
        success: true,
        review,
        product
    };
};

export default {
    getProductReviews,
    createReview,
    updateReview,
    removeReview,
    getReviewFormData,
    getEditReviewPageData
};
