import Order from "../../Model/orderModel.js";
import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";

const loadOrder = async (req, res) => {
    try {

        const userId = req.session.user;

        const user = await User.findById(userId);

        const search = req.query.search?.trim() || "";
        
        const page = parseInt(req.query.page) || 1 ;

        const limit = 3 ;
        
        const skip = (page - 1) * limit ;

        let query = {
            userId
        };

        if (search) {

            // Find matching products
            const matchedProducts = await Product.find({
                productName: {
                    $regex: search,
                    $options: "i"
                }
            }).select("_id");

            const productIds = matchedProducts.map(product => product._id);

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

        res.render("user/orders", {
            user,
            orders,
            search,
            currentPage : page,
            totalPages
        });

    } catch (error) {

        console.log("LOAD ORDER ERROR:", error);
        res.redirect("/pageNotFound");

    }
};

const loadOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.id;

        if (!userId) {
            return res.redirect("/login");
        }

        const user = await User.findById(userId);

        const order = await Order.findOne({
            _id: orderId,
            userId: userId
        }).populate("products.productId");

        const overallStatus = getOverallOrderStatus(order.products);

        if (!order) {
            return res.redirect("/user/orders");
        }

        res.render("user/order-details", {
            user,
            order,
            overallStatus
        });

    } catch (error) {
        console.log("LOAD ORDER DETAILS ERROR:", error);
        res.redirect("/pageNotFound");
    }
};

const cancelSingleProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const item = order.products.find(
            p => p.productId.toString() === productId
        );

        if (!item) {
            return res.status(404).send("Product not found in this order");
        }

        if (item.status === "cancelled") {
            return res.status(400).send("Product already cancelled");
        }

        if (item.status === "delivered" || item.status === "returned") {
            return res.status(400).send("This product cannot be cancelled");
        }

        // cancel product item
        item.status = "cancelled";
        item.cancelReason = reason || "";
        item.cancelledAt = new Date();

        // restore stock
        const product = await Product.findById(item.productId);

        if (product) {
            const matchedVariant = product.variants.id(item.variantId);

            if (matchedVariant) {
                matchedVariant.stock += item.quantity;
            }

            await product.save();
        }

        // overall order status update
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

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("cancelSingleProduct error:", error);
        res.status(500).send("Server error");
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        if (order.orderStatus === "cancelled") {
            return res.status(400).send("Order already cancelled");
        }

        if (order.orderStatus === "delivered") {
            return res.status(400).send("Delivered order cannot be cancelled");
        }

        for (const item of order.products) {
            if (item.status !== "cancelled" && item.status !== "delivered") {
                item.status = "cancelled";
                item.cancelReason = reason || "";
                item.cancelledAt = new Date();

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

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("cancelOrder error:", error);
        res.status(500).send("Server error");
    }
};

const returnSingleProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const item = order.products.find(
            p => p.productId.toString() === productId
        );

        if (!item) {
            return res.status(404).send("Product not found in this order");
        }

        // only delivered products can be returned
        if (item.status !== "delivered") {
            return res.status(400).send("Only delivered products can be returned");
        }

        // mark return request
        item.status = "return_requested";
        item.returnReason = reason || "";
        item.returnRequestedAt = new Date();

        await order.save();

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("returnSingleProduct error:", error);
        res.status(500).send("Server error");
    }
};

const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        if (order.orderStatus !== "delivered") {
            return res.status(400).send("Only delivered orders can be returned");
        }

        for (const item of order.products) {
            if (item.status === "delivered") {
                item.status = "return_requested";
                item.returnReason = reason || "";
                item.returnRequestedAt = new Date();
            }
        }

        await order.save();

        return res.redirect(`/user/order-details/${orderId}`);

    } catch (error) {
        console.error("returnOrder error:", error);
        res.status(500).send("Server error");
    }
};

const getOverallOrderStatus = (products) => {

    const statuses = products.map(item => item.status);

    const uniqueStatuses = [...new Set(statuses)];

    if (uniqueStatuses.length > 1) {
        return "Mixed Status";
    }

    switch (uniqueStatuses[0]) {
        case "pending":
            return "Pending";
        case "shipped":
            return "Shipped";
        case "out_for_delivery":
            return "Out For Delivery";
        case "delivered":
            return "Delivered";
        case "cancelled":
            return "Cancelled";
        case "returned":
            return "Returned";
        default:
            return "Pending";
    }
};

export default {
    loadOrder,
    loadOrderDetails,
    cancelSingleProduct,
    cancelOrder,
    returnSingleProduct,
    returnOrder,
    getOverallOrderStatus
};