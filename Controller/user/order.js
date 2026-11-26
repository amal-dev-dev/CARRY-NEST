import User from "../../Model/userModel.js";
import orderService from "../../Service/user/orderService.js";


// ============================================================
// LOAD ORDERS
// ============================================================

const loadOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const search = req.query.search?.trim() || "";
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const data = await orderService.getUserOrders(
            userId,
            search,
            page
        );

        return res.render("user/orders", {
            user,
            orders: data.orders,
            search,
            currentPage: data.currentPage,
            totalPages: data.totalPages
        });

    } catch (error) {
        console.error("LOAD ORDER ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};


// ============================================================
// LOAD ORDER DETAILS
// ============================================================

const loadOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const data = await orderService.getOrderDetails(
            req.params.id,
            userId
        );

        if (!data) {
            return res.redirect("/user/orders");
        }

        const {
            order,
            overallStatus,
            subtotal,
            productDiscount,
            offerDiscount,
            discountApplied: couponDiscount,
            deliveryFee: delivery,
            total: currentTotal
        } = data;

        return res.render("user/order-details", {
            user,
            order,
            overallStatus,
            subtotal,
            productDiscount,
            offerDiscount,
            couponDiscount,
            delivery,
            currentTotal
        });

    } catch (error) {
        console.error("LOAD ORDER DETAILS ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};


// ============================================================
// LOAD ORDER SUCCESS
// ============================================================

const loadOrderSuccess = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const { orderId } = req.params;

        const order = await orderService.getOrderSuccess(
            orderId,
            userId
        );

        if (!order) {
            return res.redirect("/user/home");
        }

        return res.render("user/order-success", {
            order
        });

    } catch (error) {
        console.error("LOAD ORDER SUCCESS ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};


// ============================================================
// CANCEL SINGLE PRODUCT
// ============================================================

const cancelSingleProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { reason } = req.body;

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        await orderService.cancelSingleProduct(
            orderId,
            productId,
            userId,
            reason
        );

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("CANCEL SINGLE PRODUCT ERROR:", error);

        const validationErrors = [
            "Order not found",
            "Product not found in this order",
            "Product already cancelled",
            "This product cannot be cancelled"
        ];

        if (validationErrors.includes(error.message)) {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Server error");
    }
};


// ============================================================
// CANCEL ENTIRE ORDER
// ============================================================

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        await orderService.cancelOrder(
            orderId,
            userId,
            reason
        );

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("CANCEL ORDER ERROR:", error);

        const validationErrors = [
            "Order not found",
            "Order already cancelled",
            "Delivered order cannot be cancelled"
        ];

        if (validationErrors.includes(error.message)) {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Server error");
    }
};


// ============================================================
// RETURN SINGLE PRODUCT
// ============================================================

const returnSingleProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { reason } = req.body;

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        await orderService.returnSingleProduct(
            orderId,
            productId,
            userId,
            reason
        );

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("RETURN SINGLE PRODUCT ERROR:", error);

        const validationErrors = [
            "Order not found",
            "Product not found in this order",
            "Only delivered products can be returned"
        ];

        if (validationErrors.includes(error.message)) {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Server error");
    }
};


// ============================================================
// RETURN ENTIRE ORDER
// ============================================================

const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        await orderService.returnOrder(
            orderId,
            userId,
            reason
        );

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("RETURN ORDER ERROR:", error);

        const validationErrors = [
            "Order not found",
            "Only delivered orders can be returned"
        ];

        if (validationErrors.includes(error.message)) {
            return res.status(400).send(error.message);
        }

        return res.status(500).send("Server error");
    }
};



// ============================================================
// EXPORT
// ============================================================

export default {

    loadOrder,
    loadOrderDetails,
    loadOrderSuccess,

    cancelSingleProduct,
    cancelOrder,

    returnSingleProduct,
    returnOrder,
};