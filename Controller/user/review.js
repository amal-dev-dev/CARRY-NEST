import reviewService from "../../Service/user/reviewService.js";

// 1. GET REVIEWS FOR A PRODUCT
const loadReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await reviewService.getProductReviews(productId);

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json(result);

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

        const result = await reviewService.createReview(
            userId,
            productId,
            orderId,
            { rating, title, comment }
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
            });
        }

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully.",
            review: result.review
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

        const result = await reviewService.updateReview(
            userId,
            reviewId,
            { rating, title, comment }
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
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
        const userId = req.session.user;
        const { reviewId } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in."
            });
        }

        const result = await reviewService.removeReview(userId, reviewId);

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
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

// 5. LOAD REVIEW FORM
const loadReviewForm = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, productId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const result = await reviewService.getReviewFormData(
            userId,
            orderId,
            productId
        );

        if (!result.success) {
            return res.status(result.status).send(result.message);
        }

        if (result.existingReviewId) {
            return res.redirect(
                `/user/reviews/${result.existingReviewId}/edit`
            );
        }

        return res.render("user/write-review", {
            order: result.order,
            product: result.product,
            backUrl: `/user/order-details/${orderId}`
        });

    } catch (error) {
        console.error("LOAD REVIEW FORM ERROR:", error);

        return res.status(500).send("Unable to load the review page.");
    }
};

// 6. LOAD EDIT REVIEW PAGE
const loadEditReview = async (req, res) => {
    try {
        const userId = req.session.user;
        const { reviewId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const result = await reviewService.getEditReviewPageData(
            userId,
            reviewId
        );

        if (!result.success) {
            return res.status(result.status).send(result.message);
        }

        return res.render("user/edit-review", {
            review: result.review,
            product: result.product,
            backUrl: `/user/order-details/${result.review.orderId}`
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
