
import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";
import Order from "../../Model/orderModel.js";

const loadDashboard = async (req, res) => {
    try {

        // =========================================
        // 1. BASIC DASHBOARD STATISTICS
        // =========================================

        const activeCustomers = await User.countDocuments({
            isBlocked: false
        });

        const totalOrders = await Order.countDocuments();

        const pendingOrders = await Order.countDocuments({
            orderStatus: "pending"
        });

        const totalProducts = await Product.countDocuments({});

        // =========================================
        // 2. LOW STOCK PRODUCTS
        // =========================================

        const products = await Product.find({
            isBlocked: false
        });

        const lowStockProducts = await Product.aggregate([
            { $unwind: "$variants" },
            {
                $match: {
                    "variants.stock": { $lte: 5 }
                }
            },
            { $count: "count" }
        ]);

        // =========================================
        // 3. TOTAL REVENUE
        // =========================================

        const revenueResult = await Order.aggregate([
            {
                $match: {
                    paymentStatus: "completed"
                }
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$totalAmount"
                    }
                }
            }
        ]);

        const totalRevenue =
            revenueResult.length > 0
                ? revenueResult[0].total
                : 0;

        // =========================================
        // 4. RETURN REQUESTS
        // =========================================

        const returnRequests = await Order.countDocuments({
            "products.returnStatus": "requested"
        });

        const refundPending = await Order.countDocuments({
            "products.refundStatus": "pending"
        });

        const pendingActions =
            pendingOrders +
            returnRequests +
            lowStockProducts.length;

        // =========================================
        // 5. RECENT ORDERS
        // =========================================

        const recentOrders = await Order.find()
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .limit(5);

        // =========================================
        // 6. ANALYTICS DATE FILTER
        // Same logic as Sales Report
        // =========================================

        const period = req.query.period || "30";

        const customStartDate = req.query.startDate;

        const customEndDate = req.query.endDate;

        let startDate;

        let endDate;


        // CUSTOM DATE RANGE
        if (
            period === "custom" &&
            customStartDate &&
            customEndDate
        ) {

            startDate = new Date(customStartDate);

            endDate = new Date(customEndDate);


            if (
                isNaN(startDate.getTime()) ||
                isNaN(endDate.getTime())
            ) {

                return res.status(400).send("Invalid custom date range");

            }


            startDate.setHours(0, 0, 0, 0);

            endDate.setHours(23, 59, 59, 999);


            if (startDate > endDate) {

                return res.status(400).send(
                    "Start date cannot be after end date"
                );

            }

        }


        // PRESET DATE RANGE
        else {

            const periodNumber = Number(period) || 30;

            endDate = new Date();

            startDate = new Date();


            if (periodNumber === 365) {

                // Beginning of current year
                startDate.setMonth(0);

                startDate.setDate(1);

                startDate.setHours(0, 0, 0, 0);

            } else {

                startDate.setDate(
                    startDate.getDate() - periodNumber
                );

                startDate.setHours(0, 0, 0, 0);

            }

        }

        // =========================================
        // 7. GET ANALYTICS ORDERS
        // =========================================

        const analyticsOrders = await Order.find({
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        })
            .populate("products.productId", "productName")
            .sort({ createdAt: 1 });

        // =========================================
        // 8. HELPER FUNCTIONS
        // =========================================

        const getStatus = (order) => {

            return String(order.orderStatus || "")
                .trim()
                .toLowerCase();

        };

        const isActiveProduct = (item) => {

            return ![
                "cancelled",
                "returned"
            ].includes(
                String(item.status || "").toLowerCase()
            );

        };

        const isCompletedRefund = (item) => {

            return (
                String(item.refundStatus || "").toLowerCase() ===
                "completed"
            );

        };

        const getItemAmount = (item) => {

            const price = Number(item.price) || 0;

            const quantity = Number(item.quantity) || 0;

            return price * quantity;

        };

        // =========================================
        // 9. ORDER STATUS DATA
        // =========================================

        const statusOrders = analyticsOrders.map(order => ({
            date: new Date(order.createdAt).toISOString().split("T")[0],
            status: getStatus(order) || "unknown"
        }));

        // =========================================
        // 10. BEST SELLING PRODUCTS
        // =========================================

        const productStats = {};

        analyticsOrders.forEach(order => {

            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach(item => {

                // Ignore cancelled and returned items
                if (!isActiveProduct(item)) {
                    return;
                }

                const productData = item.productId;

                if (!productData) {
                    return;
                }

                const productId = String(productData._id);

                if (!productStats[productId]) {

                    productStats[productId] = {

                        productName:
                            productData.productName ||
                            "Unknown Product",

                        orders: 0,

                        units: 0,

                        revenue: 0

                    };

                }

                const quantity = Number(item.quantity) || 0;

                const price = Number(item.price) || 0;

                productStats[productId].orders++;

                productStats[productId].units += quantity;

                productStats[productId].revenue +=
                    price * quantity;

            });

        });

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // =========================================
        // 11. SALES OVERVIEW CHART
        // =========================================

        const revenueByDate = {};

        analyticsOrders.forEach(order => {

            if (!order.createdAt) {
                return;
            }

            const date = new Date(order.createdAt)
                .toISOString()
                .split("T")[0];

            let grossAmount = 0;

            let refundedAmount = 0;

            if (Array.isArray(order.products)) {

                order.products.forEach(item => {

                    grossAmount += getItemAmount(item);

                    if (isCompletedRefund(item)) {

                        refundedAmount +=
                            Number(item.refundAmount) || 0;

                    }

                });

            }

            const netAmount = Math.max(
                0,
                grossAmount - refundedAmount
            );

            revenueByDate[date] =
                (revenueByDate[date] || 0) + netAmount;

        });

        const salesChart = Object.entries(revenueByDate)
            .map(([date, amount]) => ({
                date,
                amount
            }))
            .sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );

        // =========================================
        // 12. ORDERS OVERVIEW CHART
        // =========================================

        const ordersByDate = {};

        analyticsOrders.forEach(order => {

            if (!order.createdAt) {
                return;
            }

            const date = new Date(order.createdAt)
                .toISOString()
                .split("T")[0];

            ordersByDate[date] =
                (ordersByDate[date] || 0) + 1;

        });

        const ordersChart = Object.entries(ordersByDate)
            .map(([date, count]) => ({
                date,
                count
            }))
            .sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );

        // =========================================
        // 13. RENDER DASHBOARD
        // =========================================

        res.render("admin/dashboard", {

            totalRevenue,
            totalOrders,
            totalProducts,
            activeCustomers,
            pendingActions,

            pendingOrders,
            returnRequests,
            refundPending,

            lowStockProducts,
            recentOrders,

            // Analytics data
            salesChart,
            ordersChart,
            statusOrders,
            topProducts,

            // Selected date filter
            period,
            startDateInput: customStartDate || "",
            endDateInput: customEndDate || ""

        });

    } catch (error) {

        console.log("ADMIN DASHBOARD ERROR:", error);

        res.redirect("/admin/pageNotFound");

    }
};

export default { loadDashboard };
