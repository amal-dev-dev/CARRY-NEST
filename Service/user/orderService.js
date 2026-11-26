    import Order from "../../Model/orderModel.js";
    import Product from "../../Model/productModel.js";


    const calculateRefundAmount = (order, cancelledItem) => {
        const originalSubtotal = order.products.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const itemTotal = cancelledItem.price * cancelledItem.quantity;

        const couponDiscount = order.discountApplied || 0;

        const itemCouponDiscount =
            originalSubtotal > 0
                ? (itemTotal / originalSubtotal) * couponDiscount
                : 0;

        return Math.max(0, itemTotal - itemCouponDiscount);
    };


    const calculateRemainingOrderTotal = (order) => {
        const activeProducts = order.products.filter(
            (item) =>
                !["cancelled", "returned"].includes(item.status)
        );

        const subtotal = activeProducts.reduce(
            (sum, item) => sum + item.regularPrice * item.quantity,
            0
        );

        const productDiscount = activeProducts.reduce(
            (sum, item) => sum + item.productDiscount * item.quantity,
            0
        );

        const offerDiscount = activeProducts.reduce(
            (sum, item) => sum + item.offerDiscount * item.quantity,
            0
        );

        const remainingItemsTotal = activeProducts.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const originalItemsTotal = order.products.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const couponDiscount = order.discountApplied || 0;

        const remainingCouponDiscount =
            originalItemsTotal > 0
                ? (remainingItemsTotal / originalItemsTotal) * couponDiscount
                : 0;

        const deliveryFee = activeProducts.length > 0 ? order.deliveryFee : 0;

        const total =
            remainingItemsTotal - remainingCouponDiscount + deliveryFee;

        return {
            subtotal,
            productDiscount,
            offerDiscount,
            discountApplied: remainingCouponDiscount,
            deliveryFee,
            total
        };
    };


    const getOverallOrderStatus = (order) => {
        if (order.orderStatus === "payment_failed") {
            return "Payment Failed";
        }

        const statuses = order.products.map((item) => item.status);

        const uniqueStatuses = [...new Set(statuses)];

        if (uniqueStatuses.length > 1) {
            return "Mixed Status";
        }

        const status = uniqueStatuses[0];

        const statusMap = {
            pending: "Pending",
            shipped: "Shipped",
            out_for_delivery: "Out for Delivery",
            delivered: "Delivered",
            cancelled: "Cancelled",
            returned: "Returned"
        };

        return statusMap[status] || "Pending";
    };


    const getUserOrders = async (userId, search = "", page = 1) => {
        const limit = 3;
        const skip = (page - 1) * limit;

        const query = { userId };

        if (search) {
            const matchedProducts = await Product.find({
                productName: {
                    $regex: search,
                    $options: "i"
                }
            }).select("_id");

            const productIds = matchedProducts.map(
                product => product._id
            );

            query.$or = [
                {
                    orderId: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "products.productId": {
                        $in: productIds
                    }
                }
            ];
        }

        const totalOrders = await Order.countDocuments(query);

        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .populate("products.productId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return {
            orders,
            totalPages,
            currentPage: page
        };
    };

    const getOrderDetails = async (orderId, userId) => {
        const order = await Order.findOne({
            _id: orderId,
            userId
        }).populate("products.productId");

        if (!order) {
            return null;
        }

        const overallStatus = getOverallOrderStatus(order);

        const orderTotals = calculateRemainingOrderTotal(order);

        return {
            order,
            overallStatus,
            ...orderTotals
        };
    };


    const getOrderSuccess = async (orderId, userId) => {
        return await Order.findOne({
            _id: orderId,
            userId
        });
    };


    const cancelSingleProduct = async (orderId, productId, userId, reason) => {
        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            throw new Error("Order not found");
        }

        const item = order.products.id(productId);

        if (!item) {
            throw new Error("Product not found in this order");
        }

        if (item.status === "cancelled") {
            throw new Error("Product already cancelled");
        }

        if (["delivered", "returned"].includes(item.status)) {
            throw new Error("This product cannot be cancelled");
        }

        const refundAmount = calculateRefundAmount(order, item);

        item.status = "cancelled";
        item.cancelReason = reason || "";
        item.cancelledAt = new Date();
        item.refundStatus = "pending";
        item.refundAmount = refundAmount;

        const product = await Product.findById(item.productId);

        if (!product) {
            throw new Error("Product not found while restoring stock");
        }

        const matchedVariant = product.variants.id(item.variantId);

        if (!matchedVariant) {
            throw new Error("Product variant not found while restoring stock");
        }

        matchedVariant.stock += item.quantity;

        await product.save();

        const allCancelled = order.products.every(
            p => p.status === "cancelled"
        );

        const hasCancelled = order.products.some(
            p => p.status === "cancelled"
        );

        if (allCancelled) {
            order.orderStatus = "cancelled";
        } else if (hasCancelled) {
            order.orderStatus = "partially_cancelled";
        }

        await order.save();

        return order;
    };


    const cancelOrder = async (orderId, userId, reason) => {
        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            throw new Error("Order not found");
        }

        if (order.orderStatus === "cancelled") {
            throw new Error("Order already cancelled");
        }

        if (order.orderStatus === "delivered") {
            throw new Error("Delivered order cannot be cancelled");
        }

        for (const item of order.products) {
            if (
                item.status !== "cancelled" &&
                item.status !== "delivered"
            ) {
                // Calculate refund before changing item status
                const refundAmount = calculateRefundAmount(order, item);

                item.status = "cancelled";
                item.cancelReason = reason || "";
                item.cancelledAt = new Date();

                // Admin will process this refund later
                item.refundStatus = "pending";
                item.refundAmount = refundAmount;

                // Restore product stock
                const product = await Product.findById(item.productId);

                if (product) {
                    const matchedVariant = product.variants.id(item.variantId);

                    if (matchedVariant) {
                        matchedVariant.stock += item.quantity;
                    }

                    await product.save();
                }
            }
        }

        order.orderStatus = "cancelled";

        await order.save();

        return order;
    };


    const returnSingleProduct = async (orderId, productId, userId, reason) => {
        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            throw new Error("Order not found");
        }

        const item = order.products.id(productId);

        if (!item) {
            throw new Error("Product not found in this order");
        }

        if (item.status !== "delivered") {
            throw new Error("Only delivered products can be returned");
        }

        item.status = "return_requested";
        item.returnStatus = "requested";
        item.returnReason = reason;
        item.returnedAt = null;

        await order.save();

        return order;
    };


    const returnOrder = async (orderId, userId, reason) => {
        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            throw new Error("Order not found");
        }

        if (order.orderStatus !== "delivered") {
            throw new Error("Only delivered orders can be returned");
        }

        for (const item of order.products) {
            if (item.status === "delivered") {
                item.status = "return_requested";
                item.returnReason = reason || "";
                item.returnRequestedAt = new Date();
            }
        }

        await order.save();

        return order;
    };


    const orderService = {
        calculateRefundAmount,
        calculateRemainingOrderTotal,
        getOverallOrderStatus,
        getUserOrders,
        getOrderDetails,
        getOrderSuccess,
        cancelSingleProduct,
        cancelOrder,
        returnSingleProduct,
        returnOrder
    };

    export default orderService;