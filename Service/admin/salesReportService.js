// Service/admin/salesReportService.js

import Order from "../../Model/orderModel.js";
import Category from "../../Model/categoryModel.js";

// =========================================================
// HELPER FUNCTIONS
// =========================================================

const getStatus = (order) => {
    return String(order.orderStatus || "")
        .trim()
        .toLowerCase();
};

const isActiveProduct = (item) => {
    return !["cancelled", "returned"].includes(
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

const hasSaleItems = (order) => {
    if (!Array.isArray(order.products)) {
        return false;
    }

    return order.products.some((item) => getItemAmount(item) > 0);
};

// =========================================================
// DATE FILTER
// =========================================================

const getDateRange = (period, customStartDate, customEndDate) => {
    let startDate;
    let endDate;

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
            const error = new Error("Invalid custom date range");
            error.statusCode = 400;
            throw error;
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (startDate > endDate) {
            const error = new Error(
                "Start date cannot be after end date"
            );

            error.statusCode = 400;
            throw error;
        }
    } else {
        const periodNumber = Number(period) || 30;

        endDate = new Date();
        startDate = new Date();

        if (periodNumber === 365) {
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

    return { startDate, endDate };
};

// =========================================================
// MAIN SALES REPORT SERVICE
// =========================================================

const getSalesReportData = async (filters = {}) => {
    const {
        status,
        payment,
        category,
        product,
        period = "30",
        startDate: customStartDate,
        endDate: customEndDate,
        page
    } = filters;

    // 1. DATE RANGE

    const { startDate, endDate } = getDateRange(
        period,
        customStartDate,
        customEndDate
    );

    // 2. GET ORDERS

    const orders = await Order.find({
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    })
        .populate("userId")
        .populate({
            path: "products.productId",
            populate: {
                path: "category"
            }
        })
        .sort({ createdAt: -1 });

    let filteredOrders = orders;

    // 3. STATUS FILTER

    if (status) {
        filteredOrders = filteredOrders.filter((order) => {
            return (
                String(order.orderStatus || "").toLowerCase() ===
                status.toLowerCase()
            );
        });
    }

    // 4. PAYMENT FILTER

    if (payment) {
        filteredOrders = filteredOrders.filter((order) => {
            return (
                String(order.paymentMethod || "").toLowerCase() ===
                payment.toLowerCase()
            );
        });
    }

    // 5. CATEGORY FILTER

    if (category) {
        filteredOrders = filteredOrders.filter((order) => {
            return order.products.some((item) => {
                return (
                    String(item.productId?.category?._id || "") ===
                    String(category)
                );
            });
        });
    }

    // 6. PRODUCT SEARCH

    if (product) {
        const search = product.toLowerCase().trim();

        filteredOrders = filteredOrders.filter((order) => {
            return order.products.some((item) => {
                const name = item.productId?.productName || "";

                return name.toLowerCase().includes(search);
            });
        });
    }

    // 7. GET CATEGORIES

    const categories = await Category.find({})
        .sort({ name: 1 });

    // 8. BASIC COUNTS

    const totalOrders = filteredOrders.length;

    let totalItemsSold = 0;
    let grossRevenue = 0;
    let refundAmount = 0;
    let totalDiscount = 0;

    filteredOrders.forEach((order) => {
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        products.forEach((item) => {
            if (isActiveProduct(item)) {
                totalItemsSold += Number(item.quantity) || 0;
            }

            grossRevenue += getItemAmount(item);

            if (isCompletedRefund(item)) {
                refundAmount += Number(item.refundAmount) || 0;
            }
        });

        if (hasSaleItems(order)) {
            totalDiscount += Number(order.discountApplied) || 0;
        }
    });

    // 9. REVENUE

    const totalRevenue = Math.max(
        0,
        grossRevenue - refundAmount
    );

    const netRevenue = Math.max(
        0,
        totalRevenue - totalDiscount
    );

    // 10. AVERAGE ORDER VALUE

    const validOrders = filteredOrders.filter(hasSaleItems).length;

    const averageOrderValue = validOrders > 0
        ? netRevenue / validOrders
        : 0;

    // 11. ORDER STATUS BREAKDOWN

    const statusCounts = {};

    filteredOrders.forEach((order) => {
        const orderStatus = getStatus(order) || "unknown";

        statusCounts[orderStatus] =
            (statusCounts[orderStatus] || 0) + 1;
    });

    const statusBreakdown = Object.entries(statusCounts)
        .map(([status, count]) => ({
            status,
            count
        }))
        .sort((a, b) => b.count - a.count);

    // 12. REFUND AND RETURN ANALYSIS

    let refundedOrders = 0;
    let totalRefundAmount = 0;

    const returnReasonCounts = {};

    filteredOrders.forEach((order) => {
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        let orderHasRefund = false;

        products.forEach((item) => {
            if (isCompletedRefund(item)) {
                orderHasRefund = true;

                totalRefundAmount +=
                    Number(item.refundAmount) || 0;
            }

            const reason = item.returnReason;

            if (
                reason &&
                (
                    item.status === "returned" ||
                    item.status === "return_requested"
                )
            ) {
                const cleanReason = String(reason).trim();

                if (cleanReason) {
                    returnReasonCounts[cleanReason] =
                        (returnReasonCounts[cleanReason] || 0) + 1;
                }
            }
        });

        if (orderHasRefund) {
            refundedOrders++;
        }
    });

    const totalReturnReasons = Object.values(returnReasonCounts)
        .reduce((sum, value) => sum + value, 0);

    const returnReasons = Object.entries(returnReasonCounts)
        .map(([reason, count]) => {
            const percentage = totalReturnReasons > 0
                ? Math.round(
                    (count / totalReturnReasons) * 100
                )
                : 0;

            return {
                reason,
                count,
                percentage
            };
        })
        .sort((a, b) => b.count - a.count);

    const refundAnalysis = {
        totalRefundAmount,
        refundedOrders,
        returnReasons
    };

    // 13. TOP SELLING PRODUCTS

    const productStats = {};

    filteredOrders.forEach((order) => {
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        products.forEach((item) => {
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
                        productData.productName || "Unknown Product",
                    orders: 0,
                    units: 0,
                    revenue: 0
                };
            }

            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;

            productStats[productId].orders++;
            productStats[productId].units += quantity;
            productStats[productId].revenue += price * quantity;
        });
    });

    const topProducts = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    // 14. TOP CATEGORIES

    const categoryStats = {};

    filteredOrders.forEach((order) => {
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        products.forEach((item) => {
            if (!isActiveProduct(item)) {
                return;
            }

            const productData = item.productId;

            if (!productData) {
                return;
            }

            const categoryData = productData.category;

            if (!categoryData) {
                return;
            }

            const categoryId = String(categoryData._id);
            const categoryName =
                categoryData.name || "Unknown Category";

            if (!categoryStats[categoryId]) {
                categoryStats[categoryId] = {
                    categoryName,
                    orders: 0,
                    revenue: 0
                };
            }

            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;

            categoryStats[categoryId].orders++;
            categoryStats[categoryId].revenue += price * quantity;
        });
    });

    const topCategories = Object.values(categoryStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    // 15. TOP CUSTOMERS

    const customerStats = {};

    filteredOrders.forEach((order) => {
        const user = order.userId;

        if (!user) {
            return;
        }

        const userId = String(user._id);

        if (!customerStats[userId]) {
            customerStats[userId] = {
                name:
                    user.name ||
                    user.fullName ||
                    user.username ||
                    user.email ||
                    "Unknown Customer",
                orders: 0,
                spent: 0
            };
        }

        let orderAmount = 0;

        if (Array.isArray(order.products)) {
            order.products.forEach((item) => {
                if (!isActiveProduct(item)) {
                    return;
                }

                orderAmount += getItemAmount(item);
            });
        }

        if (orderAmount <= 0) {
            return;
        }

        customerStats[userId].orders++;
        customerStats[userId].spent += orderAmount;
    });

    const topCustomers = Object.values(customerStats)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);

    // 16. REVENUE CHART

    const revenueByDate = {};

    filteredOrders.forEach((order) => {
        if (!order.createdAt) {
            return;
        }

        const date = new Date(order.createdAt)
            .toISOString()
            .split("T")[0];

        let grossAmount = 0;
        let refundedAmount = 0;

        if (Array.isArray(order.products)) {
            order.products.forEach((item) => {
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
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 17. ORDERS CHART

    const ordersByDate = {};

    filteredOrders.forEach((order) => {
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
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 18. SALES ORDERS TABLE

    const salesOrders = filteredOrders.map((order) => {
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        const items = products.reduce((sum, item) => {
            if (!isActiveProduct(item)) {
                return sum;
            }

            return sum + (Number(item.quantity) || 0);
        }, 0);

        const amount = products.reduce((sum, item) => {
            if (!isActiveProduct(item)) {
                return sum;
            }

            return sum + getItemAmount(item);
        }, 0);

        const user = order.userId;

        return {
            orderId: order.orderId || "N/A",
            date: order.createdAt,
            customer:
                user?.name ||
                user?.fullName ||
                user?.username ||
                user?.email ||
                "Unknown Customer",
            items,
            amount,
            paymentMethod: order.paymentMethod || "N/A",
            paymentStatus: order.paymentStatus || "N/A",
            orderStatus: order.orderStatus || "N/A"
        };
    });

    // 19. PAGINATION

    const limit = 10;
    const totalSalesOrders = salesOrders.length;

    const totalPages = Math.ceil(totalSalesOrders / limit);

    const requestedPage = Math.max(
        1,
        parseInt(page, 10) || 1
    );

    const currentPage = Math.min(
        requestedPage,
        Math.max(totalPages, 1)
    );

    const paginatedSalesOrders = salesOrders.slice(
        (currentPage - 1) * limit,
        currentPage * limit
    );

    // 20. RETURN DATA TO CONTROLLER

    return {
        totalRevenue,
        totalOrders,
        netRevenue,
        totalItemsSold,
        refundAmount,
        averageOrderValue,
        categories,
        statusBreakdown,
        refundAnalysis,
        topProducts,
        topCategories,
        topCustomers,
        salesChart,
        totalDiscount,
        ordersChart,
        status,
        payment,
        category,
        product,
        period,
        salesOrders: paginatedSalesOrders,
        totalSalesOrders,
        currentPage,
        totalPages
    };
};

export default {
    getSalesReportData
};