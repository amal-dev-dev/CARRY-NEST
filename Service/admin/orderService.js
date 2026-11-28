import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import Wallet from "../../Model/walletModel.js";
import refundService from "./refundService.js";
import referralService from "./referralService.js";


    // Get all admin orders with search, filter and pagination
    const getAdminOrders = async (
        search,
        page,
        status,
        refundFilter
    ) => {
        const limit = 6;
        const skip = (page - 1) * limit;

        const query = {};

        // Search by order ID
        if (search) {
            query.orderId = {
                $regex: search,
                $options: "i"
            };
        }

        // Filter by order status
        if (status && status !== "all") {
            query.orderStatus = status;
        }

        // Filter paid cancellation refunds pending
        if (refundFilter === "cancellation") {
            query.paymentStatus = "completed";

            query.products = {
                $elemMatch: {
                    status: "cancelled",
                    refundStatus: "pending"
                }
            };
        }

        const totalOrders = await Order.countDocuments(query);

        const orders = await Order.find(query)
            .populate("userId")
            .populate("products.productId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOrders / limit);

        return {
            orders,
            totalOrders,
            totalPages,
            currentPage: page
        };
    };

    // Get one order with populated details
    const getAdminOrderDetails = async (orderId) => {
        return await Order.findById(orderId)
            .populate("userId")
            .populate("products.productId");
    };


    const restoreProductStock = async (item) => {
        const product = await Product.findById(item.productId);

        if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
        }

        const variant = product.variants.id(item.variantId);

        if (!variant) {
            throw new Error(`Variant not found: ${item.variantId}`);
        }

        variant.stock += Number(item.quantity);

        await product.save();
    };

    const getReturnRequests = async () => {
        const orders = await Order.find({
            "products.status": "return_requested"
        })
            .populate("userId")
            .populate("products.productId")
            .sort({ createdAt: -1 });

        const totalReturnRequests = orders.reduce(
            (total, order) =>
                total + order.products.filter(
                    item => item.status === "return_requested"
                ).length,
            0
        );

        return {
            orders,
            totalReturnRequests
        };
    };

    const getReturnRequestDetails = async (orderId, itemId) => {
        const order = await Order.findById(orderId)
            .populate("userId")
            .populate("products.productId");

        if (!order) {
            return null;
        }

        const returnProduct = order.products.id(itemId);

        if (!returnProduct) {
            return null;
        }

        if (
            !["return_requested", "returned"].includes(returnProduct.status) &&
            !["rejected", "approved"].includes(returnProduct.returnStatus)
        ) {
            return null;
        }

        return {
            order,
            returnProduct
        };
    };

    const approveReturn = async (orderId, itemId) => {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error("Order not found");
        }

        const item = order.products.id(itemId);

        if (!item || item.status !== "return_requested") {
            throw new Error("Return request not found");
        }

        const { refundAmount } =
            refundService.calculateItemRefund(order, item);

        const result = await Order.updateOne(
            {
                _id: orderId,
                products: {
                    $elemMatch: {
                        _id: itemId,
                        status: "return_requested"
                    }
                }
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

        if (result.modifiedCount === 0) {
            throw new Error("Return request already processed");
        }

        await restoreProductStock(item);

        return true;
    };

    const rejectReturn = async (orderId, itemId) => {
        const result = await Order.updateOne(
            {
                _id: orderId,
                products: {
                    $elemMatch: {
                        _id: itemId,
                        status: "return_requested"
                    }
                }
            },
            {
                $set: {
                    "products.$.status": "delivered",
                    "products.$.returnStatus": "rejected"
                }
            }
        );

        if (result.modifiedCount === 0) {
            throw new Error("Return request not found or already processed");
        }

        return true;
    };


    const updateMainOrderStatus = (order) => {
        const itemStatuses = order.products.map(item => item.status);

        const allCancelled = itemStatuses.every(
            status => status === "cancelled"
        );

        const allDelivered = itemStatuses.every(
            status => status === "delivered"
        );

        const hasCancelled = itemStatuses.some(
            status => status === "cancelled"
        );

        const hasOutForDelivery = itemStatuses.some(
            status => status === "out_for_delivery"
        );

        const hasShipped = itemStatuses.some(
            status => status === "shipped"
        );

        const hasPending = itemStatuses.some(
            status => status === "pending"
        );

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


    const updateProductStatus = async (orderId, itemId, status) => {

        const validStatuses = [
            "pending",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled"
        ];

        if (!validStatuses.includes(status)) {
            return {
                success: false,
                message: "Invalid status."
            };
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return {
                success: false,
                message: "Order not found.",
                redirect: "/admin/orders"
            };
        }

        // Prevent updating payment-failed orders
        if (
            order.paymentStatus === "failed" ||
            order.orderStatus === "payment_failed"
        ) {
            return {
                success: false,
                message: "Payment failed orders cannot be updated."
            };
        }

        const item = order.products.id(itemId);

        if (!item) {
            return {
                success: false,
                message: "Order item not found."
            };
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
            return {
                success: false,
                message: `Cannot change status from ${currentStatus.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}`
            };
        }

        // Restore stock if admin cancels the pending product
        if (status === "cancelled") {
            await restoreProductStock(item);
        }

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
                    refundAmount > 0 ? "pending" : "not_applicable";

                updateData["products.$.refundAmount"] = refundAmount;

            } else {

                // No payment collected, so no refund is due
                updateData["products.$.refundStatus"] = "not_applicable";
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

        // Load updated order
        const updatedOrder = await Order.findById(orderId);

        const previousOrderStatus = updatedOrder.orderStatus;

        // Recalculate parent order status
        updateMainOrderStatus(updatedOrder);

        await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    orderStatus: updatedOrder.orderStatus
                }
            }
        );

        // Process referral reward when delivered for the first time
        if (
            previousOrderStatus !== "delivered" &&
            updatedOrder.orderStatus === "delivered"
        ) {
            await referralService.processReferralReward(
                updatedOrder.userId,
                updatedOrder._id
            );
        }

        return {
            success: true
        };
    };



    const processRefund = async (orderId, itemId) => {
        const order = await Order.findById(orderId);

        if (!order) {
            return {
                success: false,
                message: "Order not found.",
                redirect: "/admin/orders"
            };
        }

        const item = order.products.id(itemId);
        if (!item) {
            return {
                success: false,
                message: "Order item not found."
            };
        }

        const isPaid = order.paymentStatus === "completed";

        if (!isPaid) {
            return {
                success: false,
                message: "Refund is not available because payment was not collected."
            };
        }

        if (item.refundStatus !== "pending") {
            return {
                success: false,
                message: "Refund is not pending."
            };
        }

        if (item.refundAmount <= 0) {
            return {
                success: false,
                message: "Invalid refund amount."
            };
        }

        let wallet = await Wallet.findOne({ userId: order.userId });

        if (!wallet) {
            wallet = new Wallet({
                userId: order.userId,
                balance: 0,
                transactions: []
            });
        }

        const refundAmount = item.refundAmount;

        wallet.balance += refundAmount;

        wallet.transactions.push({
            type: "credit",
            amount: refundAmount,
            description: `Refund for order ${order.orderId}`,
            orderId: order._id
        });

        await wallet.save();

        item.refundStatus = "completed";
        item.refundedAt = new Date();

        await order.save();

        return {
            success: true,
            refundAmount
        };
    };



    export default {
        getAdminOrders,
        getAdminOrderDetails,
        getReturnRequests,
        getReturnRequestDetails,
        approveReturn,
        rejectReturn,
        updateProductStatus,
        processRefund
    };
