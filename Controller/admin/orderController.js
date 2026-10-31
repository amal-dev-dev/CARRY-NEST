import Order from "../../Model/orderModel.js";
import Wallet from "../../Model/walletModel.js";
import Product from "../../Model/productModel.js";
import referralService from "../../Service/referralService.js";
import refundService from "../../Service/refundService.js";


const restoreProductStock = async (item) => {
    const product = await Product.findById(item.productId);

    if (!product) {
        throw new Error(
            `Product not found: ${item.productId}`
        );
    }

    const variant = product.variants.id(item.variantId);

    if (!variant) {
        throw new Error(
            `Variant not found: ${item.variantId}`
        );
    }

    variant.stock += Number(item.quantity);

    await product.save();
};


const loadOrders = async (req, res) => {
    try {

        const search = req.query.search ? req.query.search.trim() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = 6; 
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

        const returnProduct = order.products.find(
            item =>
                item.status === "return_requested" ||
                item.status === "returned"
        );

        if (!returnProduct) {
            return res.redirect("/admin/return-requests");
        }

        res.render("admin/return-request-details", {
            order,
            returnProduct
        });

    } catch (error) {
        console.log("LOAD RETURN REQUEST DETAILS ERROR:", error);
        res.redirect("/admin/pageerror");
    }
};

const approveReturn = async (req, res) => {
    try {

        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.redirect("/admin/return-requests");
        }

        const item = order.products.find(
            product => product.status === "return_requested"
        );

        if (!item) {
            return res.redirect("/admin/return-requests");
        }

        // Restore stock only when approving a return
        await restoreProductStock(item);

        // Calculate actual refund after coupon discount
        const {
            itemTotal,
            itemDiscount,
            refundAmount
        } = refundService.calculateItemRefund(order, item);

        await Order.updateOne(
            {
                _id: orderId,
                "products._id": item._id
            },
            {
                $set: {
                    "products.$.status": "returned",
                    "products.$.returnStatus": "approved",
                    "products.$.refundStatus": "pending",
                    "products.$.refundAmount": refundAmount
                }
            }
        );

        return res.redirect(
            `/admin/return-request-details/${orderId}`
        );

    } catch (error) {

        console.error(
            "APPROVE RETURN ERROR:",
            error
        );

        return res.redirect(
            "/admin/return-requests"
        );
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

        const validStatuses = [
            "pending",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled"
        ];

        if (!validStatuses.includes(status)) {
            req.session.errorMessage = "Invalid status.";
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.redirect("/admin/orders");
        }

        // Payment failed orders cannot be updated
        if (
            order.paymentStatus === "failed" ||
            order.orderStatus === "payment_failed"
        ) {
            req.session.errorMessage =
                "Payment failed orders cannot be updated.";

            return res.redirect(`/admin/order-details/${orderId}`);
        }

        const item = order.products.id(itemId);

        if (!item) {
            req.session.errorMessage = "Order item not found.";
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        const currentStatus = item.status;

        const validTransitions = {
            pending: ["shipped", "cancelled"],
            shipped: ["out_for_delivery"],
            out_for_delivery: ["delivered"],
            delivered: [],
            cancelled: [],
            returned: []
        };

        if (
            !validTransitions[currentStatus] ||
            !validTransitions[currentStatus].includes(status)
        ) {

            req.session.errorMessage =
                `Cannot change status from ${currentStatus.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}`;

            return res.redirect(`/admin/order-details/${orderId}`);
        }

        // Restore stock when admin cancels a pending item
        if (status === "cancelled") {
            await restoreProductStock(item);
        }

        // Update only the selected product status
        const updateData = {
            "products.$.status": status
        };

        if (status === "cancelled") {
            const isPaid =
                order.paymentStatus === "completed" ||
                order.paymentStatus === "paid";

            updateData["products.$.cancelledAt"] = new Date();

            if (isPaid) {
                const { refundAmount } =
                    refundService.calculateItemRefund(order, item);

                updateData["products.$.refundStatus"] =
                    refundAmount > 0 ? "pending" : "not_required";

                updateData["products.$.refundAmount"] = refundAmount;
            } else {
                // No payment collected, so no refund is due.
                updateData["products.$.refundStatus"] = "not_required";
                updateData["products.$.refundAmount"] = 0;
            }
        }

        await Order.updateOne(
            {
                _id: orderId,
                "products._id": itemId
            },
            {
                $set: updateData
            }
        );

        // Get updated order
        const updatedOrder = await Order.findById(orderId);

        // Store previous order status
        const previousOrderStatus =
            updatedOrder.orderStatus;

        // Update main order status
        updateMainOrderStatus(updatedOrder);

        await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    orderStatus: updatedOrder.orderStatus
                }
            }
        );


        // ----------------------------------------------------
        // Process referral reward only when the order
        // becomes delivered for the first time
        // ----------------------------------------------------

        if (
            previousOrderStatus !== "delivered" &&
            updatedOrder.orderStatus === "delivered"
        ) {

            await referralService.processReferralReward(
                updatedOrder.userId,
                updatedOrder._id
            );
        }

        req.session.successMessage = "Product status updated successfully.";

        return res.redirect(`/admin/order-details/${orderId}`);

    } catch (error) {

        console.error("UPDATE PRODUCT STATUS ERROR:", error);

        req.session.errorMessage = "Failed to update product status.";

        return res.redirect(`/admin/order-details/${req.params.orderId}`);
    }
};

const processRefund = async (req, res) => {
    try {

        const { orderId, itemId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            req.session.errorMessage = "Order not found.";
            return res.redirect("/admin/orders");
        }

        const item = order.products.id(itemId);

        if (!item) {
            req.session.errorMessage = "Order item not found.";
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        const isPaid =
            order.paymentStatus === "completed" ||
            order.paymentStatus === "paid";

        if (!isPaid) {
            req.session.errorMessage =
                "Refund is not available because payment was not collected.";

            return res.redirect(`/admin/order-details/${orderId}`);
        }

        if (item.refundStatus !== "pending") {
            req.session.errorMessage = "Refund is not pending.";
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        if (item.refundAmount <= 0) {
            req.session.errorMessage = "Invalid refund amount.";
            return res.redirect(`/admin/order-details/${orderId}`);
        }

        // Find user's wallet
        let wallet = await Wallet.findOne({
            userId: order.userId
        });

        // Create wallet if it doesn't exist
        if (!wallet) {
            wallet = new Wallet({
                userId: order.userId,
                balance: 0,
                transactions: []
            });
        }

        const refundAmount = item.refundAmount;

        // Add refund to wallet
        wallet.balance += refundAmount;

        wallet.transactions.push({
            type: "credit",
            amount: refundAmount,
            description: `Refund for order ${order.orderId}`
        });

        await wallet.save();

        // Update refund information
        item.refundStatus = "completed";
        item.refundedAt = new Date();

        await order.save();

        req.session.successMessage =
            `Refund of ₹${refundAmount} credited to customer's wallet.`;

        return res.redirect(`/admin/order-details/${orderId}`);

    } catch (error) {

        console.error("PROCESS REFUND ERROR:", error);

        req.session.errorMessage =
            "Failed to process refund.";

        return res.redirect(
            `/admin/order-details/${req.params.orderId}`
        );
    }
};

export default {
    loadOrders,
    loadOrderDetails,
    updateProductStatus,
    loadReturnRequests,
    loadReturnRequestDetails,
    approveReturn,
    rejectReturn,
    processRefund
};