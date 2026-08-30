import Order from "../../Model/orderModel.js";
import User from "../../Model/userModel.js";


const loadOrders = async (req, res) => {
    try {

        const search = req.query.search ? req.query.search.trim() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4; // orders per page
        const skip = (page - 1) * limit;
        const status = req.query.status;

        let query = {};

        if (search) {
            query.orderId = { $regex: search, $options: "i" };
        }

        if (status && status !== "all") {
            query.orderStatus = status;
        }

        const totalOrders = await Order.countDocuments(query);

        const orders = await Order.find(query)
            .populate("userId")
            .populate("products.productId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOrders / limit);

        res.render("admin/orders", {
            orders,
            search,
            currentPage: page,
            totalPages,
            totalOrders,
            status
        });

    } catch (error) {
        console.log("LOAD ADMIN ORDERS ERROR:", error);
        res.redirect("/admin/pageerror");
    }
};

const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId)
            .populate("userId")
            .populate("products.productId");

        if (!order) {
            return res.redirect("/admin/orders");
        }

        res.render("admin/order-details", {
            order,
            successMessage: req.session.successMessage,
            errorMessage: req.session.errorMessage
        });

        req.session.successMessage = null;
        req.session.errorMessage = null;
        
    } catch (error) {
        console.log("LOAD ADMIN ORDER DETAILS ERROR:", error);
        res.redirect("/admin/pageerror");
    }
};


const updateMainOrderStatus = (order) => {
    const itemStatuses = order.products.map(item => item.status);

    const allCancelled = itemStatuses.every(status => status === "cancelled");
    const allDelivered = itemStatuses.every(status => status === "delivered");
    const hasCancelled = itemStatuses.some(status => status === "cancelled");
    const hasOutForDelivery = itemStatuses.some(status => status === "out_for_delivery");
    const hasShipped = itemStatuses.some(status => status === "shipped");
    const hasPending = itemStatuses.some(status => status === "pending");

    if (allCancelled) {
        order.orderStatus = "cancelled";
    } else if (allDelivered) {
        order.orderStatus = "delivered";
    } else if (hasCancelled) {
        order.orderStatus = "partially_cancelled";
    } else if (hasOutForDelivery) {
        order.orderStatus = "out_for_delivery";
    } else if (hasShipped) {
        order.orderStatus = "shipped";
    } else if (hasPending) {
        order.orderStatus = "pending";
    }
};

// const updateOrderStatus = async (req, res) => {
//     try {
//         const orderId = req.params.id;
//         const { orderStatus } = req.body;

//         const validStatuses = [
//             "pending",
//             "shipped",
//             "out_for_delivery",
//             "delivered",
//             "cancelled"
//         ];

//         if (!validStatuses.includes(orderStatus)) {
//             return res.status(400).send("Invalid status");
//         }

//         const order = await Order.findById(orderId);

//         if (!order) {
//             return res.status(404).send("Order not found");
//         }

//         // Allowed status transitions
//         const validTransitions = {
//             pending: ["shipped", "cancelled"],
//             shipped: ["out_for_delivery"],
//             out_for_delivery: ["delivered"],
//             delivered: [],
//             cancelled: [],
//             returned: []
//         };

//         const currentStatus = order.orderStatus;

//         // Prevent reverting or invalid transitions
//         if (!validTransitions[currentStatus].includes(orderStatus)) {

//             req.session.errorMessage =
//                 `Cannot change status from ${currentStatus.replaceAll("_"," ")} to ${orderStatus.replaceAll("_"," ")}`;

//             return res.redirect(`/admin/order-details/${orderId}`);
//         }

//         order.orderStatus = orderStatus;

//         order.products.forEach(item => {
//             if (
//                 item.status !== "cancelled" &&
//                 item.status !== "returned"
//             ) {
//                 item.status = orderStatus;
//             }
//         });

//         await order.save();

//         req.session.successMessage = "Order status updated successfully.";

//         res.redirect(`/admin/order-details/${orderId}`);

//     } catch (error) {
//         console.log("UPDATE ORDER STATUS ERROR:", error);
//         res.redirect("/pageNotFound");
//     }
// };

const loadReturnRequests = async (req, res) => {
    try {

        const orders = await Order.find({
            "products.status": "return_requested"
        })
        .populate("userId")
        .populate("products.productId")
        .sort({ createdAt: -1 });

        res.render("admin/return-requests", {
            orders
        });

    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");
    }
};

const loadReturnRequestDetails = async (req, res) => {
    try {

        const order = await Order.findById(req.params.orderId)
            .populate("userId")
            .populate("products.productId");

        if (!order) {
            return res.redirect("/admin/return-requests");
        }

        const returnProduct = order.products.find(item =>
            ["return_requested", "returned", "delivered"].includes(item.status)
        );

        res.render("admin/return-request-details", {
            order,
            returnProduct
        });

    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");
    }
};

const approveReturn = async (req, res) => {

    try {

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.redirect("/admin/return-requests");
        }

        order.products.forEach(item => {

            if (item.status === "return_requested") {
                item.status = "returned";
            }

        });

        updateMainOrderStatus(order);

        await order.save();

        res.redirect(`/admin/return-request-details/${order._id}`);

    } catch (error) {

        console.log(error);

    }

};

const rejectReturn = async (req, res) => {

    try {

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.redirect("/admin/return-requests");
        }

        order.products.forEach(item => {

            if (item.status === "return_requested") {
                item.status = "delivered";
            }

        });

        updateMainOrderStatus(order);

        await order.save();

        res.redirect(`/admin/return-request-details/${order._id}`);

    } catch (error) {

        console.log(error);

    }

};

const updateProductStatus = async (req, res) => {
    try {

        const { orderId, itemId } = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.redirect("/admin/orders");
        }

        const item = order.products.id(itemId);

        if (!item) {
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        // Current status
        const currentStatus = item.status;

        // Allowed transitions
        const validTransitions = {
            pending: ["shipped", "cancelled"],
            shipped: ["out_for_delivery"],
            out_for_delivery: ["delivered"],
            delivered: [],
            cancelled: [],
            returned: []
        };

        if (!validTransitions[currentStatus].includes(status)) {

            req.session.errorMessage =
                `Cannot change status from ${currentStatus.replaceAll("_"," ")} to ${status.replaceAll("_"," ")}`;

            return res.redirect(`/admin/order-details/${orderId}`);
        }

        // Update product status
        item.status = status;

        // Update main order status
        updateMainOrderStatus(order);

        await order.save();

        req.session.successMessage = "Product status updated successfully.";

        res.redirect(`/admin/order-details/${orderId}`);

    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");
    }
};

export default {
    loadOrders,
    loadOrderDetails,
    updateProductStatus,
    loadReturnRequests,
    loadReturnRequestDetails,
    approveReturn,
    rejectReturn
};