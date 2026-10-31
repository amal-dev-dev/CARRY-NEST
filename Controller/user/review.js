
import mongoose from "mongoose";
import Review from "../../Model/reviewModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";

// Get the customer's ID from the login session
const getUserId = (req) => req.session.user;

// Check whether the customer received this product
const hasPurchasedProduct = async (userId, productId) => {
    return await Order.exists({
        userId,
        products: {
            $elemMatch: {
                productId,
                status: "delivered"
            }
        }
    });
};

// 1. GET REVIEWS FOR A PRODUCT
const loadReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
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

        return res.status(200).json({
            success: true,
            reviews,
            totalReviews,
            averageRating
        });

    } catch (error) {
        console.error("LOAD REVIEWS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load reviews."
        });
    }
};

// 2. ADD A REVIEW

const addReview = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.params;
        const { orderId, title, comment, rating } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in to write a review."
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(productId) ||
            !mongoose.Types.ObjectId.isValid(orderId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID or product ID."
            });
        }

        const numericRating = Number(rating);
        const reviewTitle = String(title || "").trim();
        const reviewComment = String(comment || "").trim();

        if (!Number.isInteger(numericRating) ||
            numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                success: false,
                message: "Please select a rating between 1 and 5."
            });
        }

        if (reviewTitle.length < 3 || reviewTitle.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Title must contain 3 to 100 characters."
            });
        }

        if (reviewComment.length < 3 || reviewComment.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Review must contain 3 to 1000 characters."
            });
        }

        // Verify that this order belongs to the logged-in user
        // and contains the delivered product.
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
            return res.status(403).json({
                success: false,
                message: "You can review only products delivered to you."
            });
        }

        const productExists = await Product.exists({ _id: productId });

        if (!productExists) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const existingReview = await Review.findOne({
            userId,
            productId
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        const review = await Review.create({
            userId,
            productId,
            orderId: deliveredOrder._id,
            rating: numericRating,
            title: reviewTitle,
            comment: reviewComment
        });

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully.",
            review
        });

    } catch (error) {
        console.error("ADD REVIEW ERROR:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to submit your review. Please try again."
        });
    }
};


// 3. EDIT YOUR OWN REVIEW

const editReview = async (req, res) => {
    try {
        const userId = req.session.user;
        const { reviewId } = req.params;
        const { rating, title, comment } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in to update your review."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid review ID."
            });
        }

        const numericRating = Number(rating);
        const reviewTitle = String(title || "").trim();
        const reviewComment = String(comment || "").trim();

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid rating."
            });
        }

        if (reviewTitle.length < 3 || reviewTitle.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Title must contain 3–100 characters."
            });
        }

        if (reviewComment.length < 3 || reviewComment.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Review must contain 3–1000 characters."
            });
        }

        const updatedReview = await Review.findOneAndUpdate(
            {
                _id: reviewId,
                userId: userId
            },
            {
                $set: {
                    rating: numericRating,
                    title: reviewTitle,
                    comment: reviewComment
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedReview) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you cannot edit this review."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Review updated successfully."
        });

    } catch (error) {
        console.error("EDIT REVIEW ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong while updating your review."
        });
    }
};


// 4. DELETE YOUR OWN REVIEW
const deleteReview = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { reviewId } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid review ID."
            });
        }

        const review = await Review.findOneAndDelete({
            _id: reviewId,
            userId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you do not have permission to delete it."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Review deleted successfully."
        });

    } catch (error) {
        console.error("DELETE REVIEW ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete your review."
        });
    }
};

const loadReviewForm = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, productId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        if (
            !mongoose.Types.ObjectId.isValid(orderId) ||
            !mongoose.Types.ObjectId.isValid(productId)
        ) {
            return res.status(400).send("Invalid order or product.");
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
            return res.status(403).send(
                "You can review only products delivered to you."
            );
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found.");
        }

        const existingReview = await Review.findOne({
            userId,
            productId
        });

        if (existingReview) {
            return res.redirect(
                `/user/reviews/${existingReview._id}/edit`
            );
        }

        return res.render("user/write-review", {
            order,
            product,
            backUrl: `/user/order-details/${orderId}`
        });

    } catch (error) {
        console.error("LOAD REVIEW FORM ERROR:", error);
        return res.status(500).send("Unable to load the review page.");
    }
};

const loadEditReview = async (req, res) => {
    try {
        const userId = req.session.user;
        const { reviewId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).send("Invalid review ID.");
        }

        const review = await Review.findOne({
            _id: reviewId,
            userId
        }).lean();

        if (!review) {
            return res.status(404).send("Review not found.");
        }

        const product = await Product.findById(review.productId).lean();

        if (!product) {
            return res.status(404).send("Product not found.");
        }

        return res.render("user/edit-review", {
            review,
            product,
            backUrl: `/user/order-details/${review.orderId}`
        });

    } catch (error) {
        console.error("LOAD EDIT REVIEW ERROR:", error);
        return res.status(500).send("Unable to load edit review page.");
    }
};

export default {
    loadReviews,
    addReview,
    editReview,
    deleteReview,
    loadReviewForm,
    loadEditReview
};
