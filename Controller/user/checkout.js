import checkoutService from "../../Service/user/checkoutService.js";

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const data = await checkoutService.getCheckoutPageData(
            userId,
            req.session.appliedCoupon?.couponId || null
        );

        if (data.couponError) {
            delete req.session.appliedCoupon;
            req.session.message = data.couponError;

            await new Promise((resolve, reject) => {
                req.session.save((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }

        // Get and clear session message
        const message = req.session.message;
        delete req.session.message;

        return res.render("user/checkout", {
            cart: {
                ...data.cart.toObject(),
                items: data.pricing.pricedItems
            },
            appliedCoupon: data.appliedCoupon,
            addresses: data.addresses,
            subtotal: data.pricing.subtotal,
            productDiscount: data.pricing.productDiscount,
            offerDiscount: data.pricing.offerDiscount,
            couponDiscount: data.pricing.couponDiscount,
            deliveryFee: data.pricing.deliveryFee,
            grandTotal: data.pricing.grandTotal,
            coupons: data.coupons,
            estimatedDelivery: data.estimatedDelivery,
            wallet: data.wallet,
            message,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("LOAD CHECKOUT ERROR:", error);

        if (error.code === "CHECKOUT_VALIDATION") {
            req.session.message = error.message;
            return res.redirect("/user/cart");
        }

        return res.redirect("/pageNotFound");
    }
};


const orderPlaced = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const { selectedAddress, paymentMethod } = req.body;

        const result = await checkoutService.placeOrder(
            userId,
            selectedAddress,
            paymentMethod,
            req.session.appliedCoupon?.couponId || null
        );

        // Clear applied coupon after successful order placement
        delete req.session.appliedCoupon;

        return res.render("user/order-success", {
            order: result.order
        });

    } catch (error) {
        console.error("Order placement error:", error);

        if (error.code === "CHECKOUT_VALIDATION") {
            req.session.message = error.message;
            return res.redirect("/user/checkout");
        }

        return res.status(500).send("Something went wrong while placing your order.");
    }
};


const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        if (!couponCode || !couponCode.trim()) {
            return res.json({
                success: false,
                message: "Please enter a coupon code"
            });
        }

        // Get validated cart items
        const { validItems } =
            await checkoutService.getCheckoutCart(userId);

        // Validate coupon and calculate discount
        const result =
            await checkoutService.validateAndCalculateCoupon({
                userId,
                couponCode,
                items: validItems
            });

        // Save only coupon reference and calculated discount in session
        req.session.appliedCoupon = {
            couponId: result.coupon._id,
            code: result.coupon.discountCode,
            discount: result.couponDiscount
        };

        return res.json({
            success: true,
            message: "Coupon applied successfully",
            couponCode: result.coupon.discountCode,
            discount: result.couponDiscount,
            subtotal: result.pricing.subtotal,
            productDiscount: result.pricing.productDiscount,
            offerDiscount: result.pricing.offerDiscount,
            grandTotal: result.grandTotal
        });

    } catch (error) {
        console.error("APPLY COUPON ERROR:", error);

        return res.json({
            success: false,
            message: error.code === "CHECKOUT_VALIDATION"
                ? error.message
                : "Unable to apply coupon"
        });
    }
};


const removeCoupon = async (req, res) => {
    try {
        delete req.session.appliedCoupon;

        return res.json({
            success: true,
            message: "Coupon removed successfully"
        });

    } catch (error) {
        console.log("REMOVE COUPON ERROR:", error);

        return res.json({
            success: false,
            message: "Unable to remove coupon"
        });
    }
};



export default {
    loadCheckout,
    orderPlaced,
    applyCoupon,
    removeCoupon
};

