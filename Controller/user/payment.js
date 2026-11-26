import Order from "../../Model/orderModel.js";
import paymentService from "../../Service/user/paymentService.js";


const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const result = await paymentService.createRazorpayOrder(
            userId,
            req.session.appliedCoupon?.couponId || null
        );

        return res.status(200).json({
            success: true,
            order: result.order
        });

    } catch (error) {
        console.error("RAZORPAY CREATE ORDER ERROR:", error);

        if (
            error.code === "CHECKOUT_VALIDATION" ||
            error.code === "PAYMENT_VALIDATION"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to create Razorpay order"
        });
    }
};


const verifyRazorpayPayment = async (req, res) => {
    try {
        const userId =
            req.session.user?._id || req.session.user;

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            selectedAddress
        } = req.body;

        // 1. Validate user session
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        // 2. Delegate payment verification and order processing
        const result =
            await paymentService.verifyRazorpayPayment({
                userId,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                selectedAddress,
                appliedCoupon: req.session.appliedCoupon
            });

        // 3. Clear coupon session after successful order
        delete req.session.appliedCoupon;

        // 4. Return response
        return res.status(200).json({
            success: true,
            message:
                "Payment verified and order placed successfully",
            orderId: result.orderId
        });

    } catch (error) {
        console.error(
            "RAZORPAY VERIFY ERROR:",
            error
        );

        if (
            error.code === "PAYMENT_VALIDATION" ||
            error.code === "CHECKOUT_VALIDATION"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message:
                error.code === "PAYMENT_CONFIGURATION"
                    ? error.message
                    : "An error occurred while verifying the payment"
        });
    }
};

const createFailedPaymentOrder = async (req, res) => {
    try {
        const userId =
            req.session.user?._id || req.session.user;

        const {
            selectedAddress,
            razorpay_order_id
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const result =
            await paymentService.createFailedPaymentOrder({
                userId,
                selectedAddress,
                razorpay_order_id,
                appliedCoupon: req.session.appliedCoupon
            });

        return res.status(200).json({
            success: true,
            message: "Failed payment order saved",
            orderId: result.orderId
        });

    } catch (error) {
        console.error(
            "CREATE FAILED PAYMENT ORDER ERROR:",
            error
        );

        if (error.code === "PAYMENT_VALIDATION") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to save payment failure"
        });
    }
};


const loadPaymentFailed = async (req, res) => {
    try {
        const message =
            req.query.message ||
            "Your payment could not be completed.";

        const orderId = req.query.orderId || null;

        return res.render("user/payment-failed", {
            message,
            orderId
        });

    } catch (error) {
        console.log("PAYMENT FAILED PAGE ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};

const retryPayment = async (req, res) => {
    const userId = req.session.user?._id || req.session.user;

    try {
        if (!userId) {
            return res.redirect("/user/login");
        }

        const order = await Order.findOne({
            _id: req.params.orderId,
            userId
        }).populate({
            path: "products.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        return res.render("user/retry-payment", {
            order,
            razorpayOrder: null,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            errorMessage: ""
        });

    } catch (error) {
        console.error("LOAD RETRY PAYMENT PAGE ERROR:", error);
        return res.redirect("/user/pageerror");
    }
};


const createRetryPaymentOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const { orderId } = req.params;

        const result = await paymentService.retryPayment(
            orderId,
            userId
        );

        return res.status(200).json({
            success: true,
            razorpayOrder: result.razorpayOrder,
            razorpayKeyId: result.razorpayKeyId
        });

    } catch (error) {
        if (
            error.code === "PAYMENT_VALIDATION" ||
            error.code === "ORDER_NOT_FOUND"
        ) {
            console.log(
                "CREATE RETRY PAYMENT VALIDATION:",
                error.message
            );
        } else {
            console.error(
                "CREATE RETRY PAYMENT ERROR:",
                error
            );
        }

        if (error.code === "ORDER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "PAYMENT_VALIDATION") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to start payment. Please try again."
        });
    }
};


const verifyRetryPayment = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const result = await paymentService.verifyRetryPayment({
            ...req.body,
            userId
        });

        delete req.session.appliedCoupon;

        return res.json(result);

    } catch (error) {
        if (
            error.code === "PAYMENT_VALIDATION" ||
            error.code === "CHECKOUT_VALIDATION" ||
            error.code === "ORDER_NOT_FOUND"
        ) {
            console.log("VERIFY RETRY PAYMENT VALIDATION:", error.message);
        } else {
            console.error("VERIFY RETRY PAYMENT ERROR:", error);
        }

        if (error.code === "ORDER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (
            error.code === "PAYMENT_VALIDATION" ||
            error.code === "CHECKOUT_VALIDATION"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to verify payment. Please check your order status."
        });
    }
};





export default {
    createRazorpayOrder,
    verifyRazorpayPayment,
    createFailedPaymentOrder,
    loadPaymentFailed,
    retryPayment,
    createRetryPaymentOrder,
    verifyRetryPayment
};