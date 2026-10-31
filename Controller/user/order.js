import Order from "../../Model/orderModel.js";
import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";


// ============================================================
// HELPER: Calculate refund amount for a cancelled item
// ============================================================

const calculateRefundAmount = (order, cancelledItem) => {

    // Original order subtotal
    const originalSubtotal = order.products.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);

    const itemTotal =
        cancelledItem.price * cancelledItem.quantity;

    const couponDiscount =
        Number(order.discountApplied || 0);

    // No coupon
    if (couponDiscount <= 0 || originalSubtotal <= 0) {
        return Number(itemTotal.toFixed(2));
    }

    // Allocate coupon discount proportionally
    const itemCouponDiscount =
        (itemTotal / originalSubtotal) * couponDiscount;

    const refundAmount =
        itemTotal - itemCouponDiscount;

    return Number(Math.max(0, refundAmount).toFixed(2));
};


// ============================================================
// HELPER: Calculate remaining order total
// ============================================================

const calculateRemainingOrderTotal = (order) => {
    const activeProducts = order.products.filter(item =>
        !["cancelled", "returned"].includes(item.status)
    );

    const subtotal = activeProducts.reduce((total, item) => {
        return total +
            Number(item.regularPrice || item.price || 0) *
            Number(item.quantity || 0);
    }, 0);

    let productDiscount = 0;
    let offerDiscount = 0;
    let remainingItemsTotal = 0;

    for (const item of activeProducts) {
        const quantity = Number(item.quantity || 0);
        const regularPrice = Number(item.regularPrice || item.price || 0);
        const finalPrice = Number(item.price || 0);

        let itemProductDiscount = Number(item.productDiscount || 0);
        let itemOfferDiscount = Number(item.offerDiscount || 0);

        // Fallback for older orders saved before discount fields were added.
        // This preserves the total discount, but cannot identify an old offer separately.
        if (
            itemProductDiscount === 0 &&
            itemOfferDiscount === 0 &&
            regularPrice > finalPrice
        ) {
            itemProductDiscount = regularPrice - finalPrice;
        }

        productDiscount += itemProductDiscount * quantity;
        offerDiscount += itemOfferDiscount * quantity;
        remainingItemsTotal += finalPrice * quantity;
    }

    const originalItemsTotal = order.products.reduce((total, item) => {
        return total +
            Number(item.price || 0) *
            Number(item.quantity || 0);
    }, 0);

    const originalCouponDiscount = Number(order.discountApplied || 0);

    let couponDiscount = 0;

    if (originalItemsTotal > 0) {
        couponDiscount =
            (remainingItemsTotal / originalItemsTotal) *
            originalCouponDiscount;
    }

    couponDiscount = Math.min(couponDiscount, remainingItemsTotal);

    const delivery = Number(order.deliveryFee || 0);
    const total = Math.max(
        remainingItemsTotal - couponDiscount + delivery,
        0
    );

    return {
        subtotal: Number(subtotal.toFixed(2)),
        productDiscount: Number(productDiscount.toFixed(2)),
        offerDiscount: Number(offerDiscount.toFixed(2)),
        couponDiscount: Number(couponDiscount.toFixed(2)),
        delivery,
        total: Number(total.toFixed(2))
    };
};

// ============================================================
// LOAD ORDERS
// ============================================================

const loadOrder = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const search =
            req.query.search?.trim() || "";

        const page =
            parseInt(req.query.page) || 1;

        const limit = 3;

        const skip =
            (page - 1) * limit;

        let query = {
            userId
        };

        // ---------------------------------------------
        // SEARCH
        // ---------------------------------------------

        if (search) {

            const matchedProducts =
                await Product.find({
                    productName: {
                        $regex: search,
                        $options: "i"
                    }
                }).select("_id");

            const productIds =
                matchedProducts.map(
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

        // ---------------------------------------------
        // TOTAL ORDERS
        // ---------------------------------------------

        const totalOrders =
            await Order.countDocuments(query);

        const totalPages =
            Math.ceil(
                totalOrders / limit
            );

        // ---------------------------------------------
        // GET ORDERS
        // ---------------------------------------------

        const orders =
            await Order.find(query)
                .populate("products.productId")
                .sort({
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit);

        // ---------------------------------------------
        // RENDER
        // ---------------------------------------------

        return res.render(
            "user/orders",
            {
                user,
                orders,
                search,
                currentPage: page,
                totalPages
            }
        );

    } catch (error) {

        console.error(
            "LOAD ORDER ERROR:",
            error
        );

        return res.redirect(
            "/pageNotFound"
        );
    }
};


// ============================================================
// LOAD ORDER DETAILS
// ============================================================

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
            userId
        }).populate("products.productId");

        if (!order) {
            return res.redirect("/user/orders");
        }

        const overallStatus = getOverallOrderStatus(order);

        const {
            subtotal,
            productDiscount,
            offerDiscount,
            couponDiscount,
            delivery,
            total: currentTotal
        } = calculateRemainingOrderTotal(order);


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

        console.log(
            "LOAD ORDER DETAILS ERROR:",
            error
        );

        res.redirect("/pageNotFound");
    }
};


// ============================================================
// LOAD ORDER SUCCESS
// ============================================================

const loadOrderSuccess = async (req, res) => {
    try {

        const userId = req.session.user;
        const { orderId } = req.params;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.redirect("/user/home");
        }

        return res.render("user/order-success", {
            order
        });

    } catch (error) {

        console.log(
            "LOAD ORDER SUCCESS ERROR:",
            error
        );

        return res.redirect("/pageNotFound");
    }
};


// ============================================================
// CANCEL SINGLE PRODUCT
// ============================================================

const cancelSingleProduct = async (req, res) => {
    try {

        const {
            orderId,
            productId
        } = req.params;

        const {
            reason
        } = req.body;

        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).send(
                "Order not found"
            );
        }

        const item = order.products.find(
            p =>
                p.productId.toString() === productId
        );

        if (!item) {
            return res.status(404).send(
                "Product not found in this order"
            );
        }

        if (item.status === "cancelled") {
            return res.status(400).send(
                "Product already cancelled"
            );
        }

        if (
            item.status === "delivered" ||
            item.status === "returned"
        ) {
            return res.status(400).send(
                "This product cannot be cancelled"
            );
        }


        // ----------------------------------------------------
        // Calculate refund BEFORE changing status
        // ----------------------------------------------------

        const refundAmount =
            calculateRefundAmount(order, item);


        // ----------------------------------------------------
        // Cancel product
        // ----------------------------------------------------

        item.status = "cancelled";

        item.cancelReason =
            reason || "";

        item.cancelledAt =
            new Date();


        // ----------------------------------------------------
        // Refund information
        // ----------------------------------------------------

        item.refundStatus =
            "pending";

        item.refundAmount =
            refundAmount;


        // ----------------------------------------------------
        // Restore stock
        // ----------------------------------------------------

        const product =
            await Product.findById(
                item.productId
            );

        if (product) {

            const matchedVariant =
                product.variants.id(
                    item.variantId
                );

            if (matchedVariant) {

                matchedVariant.stock +=
                    item.quantity;
            }

            await product.save();
        }


        // ----------------------------------------------------
        // Update overall order status
        // ----------------------------------------------------

        const allCancelled =
            order.products.every(
                p =>
                    p.status === "cancelled"
            );

        const hasCancelled =
            order.products.some(
                p =>
                    p.status === "cancelled"
            );

        if (allCancelled) {

            order.orderStatus =
                "cancelled";

        } else if (hasCancelled) {

            order.orderStatus =
                "partially_cancelled";
        }


        await order.save();

        return res.redirect(
            `/user/order-details/${orderId}`
        );

    } catch (error) {

        console.error(
            "cancelSingleProduct error:",
            error
        );

        res.status(500).send(
            "Server error"
        );
    }
};


// ============================================================
// CANCEL ENTIRE ORDER
// ============================================================

const cancelOrder = async (req, res) => {
    try {

        const {
            orderId
        } = req.params;

        const {
            reason
        } = req.body;

        const userId =
            req.session.user;

        const order =
            await Order.findOne({
                _id: orderId,
                userId
            });

        if (!order) {
            return res.status(404).send(
                "Order not found"
            );
        }

        if (
            order.orderStatus === "cancelled"
        ) {
            return res.status(400).send(
                "Order already cancelled"
            );
        }

        if (
            order.orderStatus === "delivered"
        ) {
            return res.status(400).send(
                "Delivered order cannot be cancelled"
            );
        }


        // ----------------------------------------------------
        // Calculate refund for every cancellable item
        // BEFORE changing statuses
        // ----------------------------------------------------

        for (const item of order.products) {

            if (
                item.status !== "cancelled" &&
                item.status !== "delivered"
            ) {

                const refundAmount =
                    calculateRefundAmount(
                        order,
                        item
                    );


                // Cancel item
                item.status =
                    "cancelled";

                item.cancelReason =
                    reason || "";

                item.cancelledAt =
                    new Date();


                // Refund information
                item.refundStatus =
                    "pending";

                item.refundAmount =
                    refundAmount;


                // Restore stock
                const product =
                    await Product.findById(
                        item.productId
                    );

                if (product) {

                    const matchedVariant =
                        product.variants.id(
                            item.variantId
                        );

                    if (matchedVariant) {

                        matchedVariant.stock +=
                            item.quantity;
                    }

                    await product.save();
                }
            }
        }


        order.orderStatus =
            "cancelled";

        await order.save();

        return res.redirect(
            `/user/order-details/${orderId}`
        );

    } catch (error) {

        console.error(
            "cancelOrder error:",
            error
        );

        res.status(500).send(
            "Server error"
        );
    }
};


// ============================================================
// RETURN SINGLE PRODUCT
// ============================================================

const returnSingleProduct = async (req, res) => {
    try {

        const {
            orderId,
            productId
        } = req.params;

        const {
            reason
        } = req.body;

        const userId =
            req.session.user;

        const order =
            await Order.findOne({
                _id: orderId,
                userId
            });

        if (!order) {
            return res.status(404).send(
                "Order not found"
            );
        }

        const item =
            order.products.find(
                p =>
                    p.productId.toString() ===
                    productId
            );

        if (!item) {
            return res.status(404).send(
                "Product not found in this order"
            );
        }


        // Only delivered products
        // can be returned
        if (
            item.status !== "delivered"
        ) {
            return res.status(400).send(
                "Only delivered products can be returned"
            );
        }


        // Return request
        item.status =
            "return_requested";

        item.returnReason =
            reason || "";

        item.returnRequestedAt =
            new Date();

        await order.save();

        return res.redirect(
            `/user/order-details/${orderId}`
        );

    } catch (error) {

        console.error(
            "returnSingleProduct error:",
            error
        );

        res.status(500).send(
            "Server error"
        );
    }
};


// ============================================================
// RETURN ENTIRE ORDER
// ============================================================

const returnOrder = async (req, res) => {
    try {

        const {
            orderId
        } = req.params;

        const {
            reason
        } = req.body;

        const userId =
            req.session.user;

        const order =
            await Order.findOne({
                _id: orderId,
                userId
            });

        if (!order) {
            return res.status(404).send(
                "Order not found"
            );
        }

        if (
            order.orderStatus !== "delivered"
        ) {
            return res.status(400).send(
                "Only delivered orders can be returned"
            );
        }


        for (const item of order.products) {

            if (
                item.status === "delivered"
            ) {

                item.status =
                    "return_requested";

                item.returnReason =
                    reason || "";

                item.returnRequestedAt =
                    new Date();
            }
        }

        await order.save();

        return res.redirect(
            `/user/order-details/${orderId}`
        );

    } catch (error) {

        console.error(
            "returnOrder error:",
            error
        );

        res.status(500).send(
            "Server error"
        );
    }
};


// ============================================================
// GET OVERALL ORDER STATUS
// ============================================================

const getOverallOrderStatus = (order) => {

    if (order.orderStatus === "payment_failed") {
        return "Payment Failed";
    }

    const products = order.products;

    const statuses =
        products.map(item => item.status);

    const uniqueStatuses =
        [...new Set(statuses)];

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

    getOverallOrderStatus
};