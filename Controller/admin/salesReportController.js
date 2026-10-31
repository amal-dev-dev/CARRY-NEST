import Order from "../../Model/orderModel.js";
import Category from "../../Model/categoryModel.js";


const loadSalesReport = async (req, res) => {
    try {
        const {
            status,
            payment,
            category,
            product
        } = req.query;

        // =========================================================
        // 1. DATE FILTER
        // =========================================================

        const period = req.query.period || "30";

        const customStartDate = req.query.startDate;
        const customEndDate = req.query.endDate;

        let startDate;
        let endDate;


        // =========================================================
        // CUSTOM DATE RANGE
        // =========================================================

        if (
            period === "custom" &&
            customStartDate &&
            customEndDate
        ) {

            startDate = new Date(customStartDate);
            endDate = new Date(customEndDate);


            // Validate dates
            if (
                isNaN(startDate.getTime()) ||
                isNaN(endDate.getTime())
            ) {

                return res.status(400).send(
                    "Invalid custom date range"
                );
            }


            // Start of selected start date
            startDate.setHours(
                0,
                0,
                0,
                0
            );


            // End of selected end date
            endDate.setHours(
                23,
                59,
                59,
                999
            );


            // Prevent invalid range
            if (startDate > endDate) {

                return res.status(400).send(
                    "Start date cannot be after end date"
                );
            }

        }


        // =========================================================
        // PRESET DATE RANGE
        // =========================================================

        else {

            const periodNumber =
                Number(period) || 30;

            endDate = new Date();
            startDate = new Date();


            if (periodNumber === 365) {

                // Beginning of current year
                startDate.setMonth(0);
                startDate.setDate(1);

                startDate.setHours(
                    0,
                    0,
                    0,
                    0
                );

            } else {

                startDate.setDate(
                    startDate.getDate() - periodNumber
                );

                startDate.setHours(
                    0,
                    0,
                    0,
                    0
                );
            }
        }

        // =========================================================
        // 2. GET ORDERS
        // =========================================================

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

        // =========================================================
        // 3. STATUS FILTER
        // =========================================================

        if (status) {
            filteredOrders = filteredOrders.filter((order) => {
                return (
                    String(order.orderStatus || "")
                        .toLowerCase() === status.toLowerCase()
                );
            });
        }

        // =========================================================
        // 4. PAYMENT FILTER
        // =========================================================

        if (payment) {
            filteredOrders = filteredOrders.filter((order) => {
                return (
                    String(order.paymentMethod || "")
                        .toLowerCase() === payment.toLowerCase()
                );
            });
        }

        // =========================================================
        // 5. CATEGORY FILTER
        // =========================================================

        if (category) {
            filteredOrders = filteredOrders.filter((order) => {
                return order.products.some((item) => {
                    return (
                        String(
                            item.productId?.category?._id || ""
                        ) === String(category)
                    );
                });
            });
        }

        // =========================================================
        // 6. PRODUCT SEARCH
        // =========================================================

        if (product) {
            const search = product.toLowerCase().trim();

            filteredOrders = filteredOrders.filter((order) => {
                return order.products.some((item) => {
                    const name =
                        item.productId?.productName || "";

                    return name
                        .toLowerCase()
                        .includes(search);
                });
            });
        }

        // =========================================================
        // 7. GET CATEGORIES
        // =========================================================

        const categories = await Category.find({})
            .sort({ name: 1 });

        // =========================================================
        // 8. HELPER FUNCTIONS
        // =========================================================

        const getStatus = (order) => {
            return String(order.orderStatus || "")
                .trim()
                .toLowerCase();
        };

        // Product is still active for item-based sales statistics
        const isActiveProduct = (item) => {
            return ![
                "cancelled",
                "returned"
            ].includes(
                String(item.status || "").toLowerCase()
            );
        };

        // Refund has actually been given to customer
        const isCompletedRefund = (item) => {
            return (
                String(item.refundStatus || "").toLowerCase() ===
                "completed"
            );
        };

        // Product line amount
        const getItemAmount = (item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;

            return price * quantity;
        };

        // Check whether order contains at least one sale item
        const hasSaleItems = (order) => {
            if (!Array.isArray(order.products)) {
                return false;
            }

            return order.products.some((item) => {
                return getItemAmount(item) > 0;
            });
        };

        // =========================================================
        // 9. BASIC COUNTS
        // =========================================================

        const totalOrders = filteredOrders.length;

        let totalItemsSold = 0;

        filteredOrders.forEach((order) => {
            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach((item) => {
                // Cancelled and returned products
                // should not be counted as items sold.
                if (!isActiveProduct(item)) {
                    return;
                }

                totalItemsSold +=
                    Number(item.quantity) || 0;
            });
        });


        let grossRevenue = 0;

        filteredOrders.forEach((order) => {
            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach((item) => {
                grossRevenue += getItemAmount(item);
            });
        });

        // =========================================================
        // 11. REFUND AMOUNT
        // =========================================================

        let refundAmount = 0;

        filteredOrders.forEach((order) => {
            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach((item) => {
                if (!isCompletedRefund(item)) {
                    return;
                }

                refundAmount +=
                    Number(item.refundAmount) || 0;
            });
        });

        // =========================================================
        // 12. TOTAL REVENUE
        // =========================================================

        const totalRevenue = Math.max(
            0,
            grossRevenue - refundAmount
        );

        // =========================================================
        // 13. DISCOUNT
        // =========================================================

        let totalDiscount = 0;

        filteredOrders.forEach((order) => {
            if (!hasSaleItems(order)) {
                return;
            }

            const discount =
                Number(order.discountApplied) || 0;

            totalDiscount += discount;
        });

        // =========================================================
        // 14. NET REVENUE
        // =========================================================
        //
        // Total Revenue = Gross Revenue - Refunds
        //
        // Net Revenue = Total Revenue - Coupon Discounts
        //
        // =========================================================

        const netRevenue = Math.max(
            0,
            totalRevenue - totalDiscount
        );

        // =========================================================
        // 15. AVERAGE ORDER VALUE
        // =========================================================

        const validOrders =
            filteredOrders.filter(hasSaleItems).length;

        const averageOrderValue =
            validOrders > 0
                ? netRevenue / validOrders
                : 0;

        // =========================================================
        // 16. ORDER STATUS BREAKDOWN
        // =========================================================

        const statusCounts = {};

        filteredOrders.forEach((order) => {
            const orderStatus =
                getStatus(order) || "unknown";

            statusCounts[orderStatus] =
                (statusCounts[orderStatus] || 0) + 1;
        });

        const statusBreakdown =
            Object.entries(statusCounts)
                .map(([status, count]) => {
                    return {
                        status,
                        count
                    };
                })
                .sort((a, b) => b.count - a.count);

        // =========================================================
        // 17. REFUND / RETURN ANALYSIS
        // =========================================================

        let refundedOrders = 0;

        let totalRefundAmount = 0;

        const returnReasonCounts = {};

        filteredOrders.forEach((order) => {
            if (!Array.isArray(order.products)) {
                return;
            }

            let orderHasRefund = false;

            order.products.forEach((item) => {

                // ---------------------------------------------
                // REFUND
                // ---------------------------------------------

                if (isCompletedRefund(item)) {
                    orderHasRefund = true;

                    totalRefundAmount +=
                        Number(item.refundAmount) || 0;
                }

                // ---------------------------------------------
                // RETURN REASON
                // ---------------------------------------------

                const reason = item.returnReason;

                if (
                    reason &&
                    (
                        item.status === "returned" ||
                        item.status === "return_requested"
                    )
                ) {
                    const cleanReason =
                        String(reason).trim();

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

        const totalReturnReasons =
            Object.values(returnReasonCounts)
                .reduce(
                    (sum, value) => sum + value,
                    0
                );

        const returnReasons =
            Object.entries(returnReasonCounts)
                .map(([reason, count]) => {

                    const percentage =
                        totalReturnReasons > 0
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
                .sort((a, b) =>
                    b.count - a.count
                );

        const refundAnalysis = {
            totalRefundAmount,
            refundedOrders,
            returnReasons
        };

        // =========================================================
        // 18. TOP SELLING PRODUCTS
        // =========================================================

        const productStats = {};

        filteredOrders.forEach((order) => {

            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach((item) => {

                // Do not count cancelled/returned items
                if (!isActiveProduct(item)) {
                    return;
                }

                const productData =
                    item.productId;

                if (!productData) {
                    return;
                }

                const productId =
                    String(productData._id);

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

                const quantity =
                    Number(item.quantity) || 0;

                const price =
                    Number(item.price) || 0;

                productStats[productId].orders++;

                productStats[productId].units +=
                    quantity;

                productStats[productId].revenue +=
                    price * quantity;
            });
        });

        const topProducts =
            Object.values(productStats)
                .sort((a, b) =>
                    b.revenue - a.revenue
                )
                .slice(0, 10);

        // =========================================================
        // 19. TOP CATEGORIES
        // =========================================================

        const categoryStats = {};

        filteredOrders.forEach((order) => {

            if (!Array.isArray(order.products)) {
                return;
            }

            order.products.forEach((item) => {

                // Do not count cancelled/returned items
                if (!isActiveProduct(item)) {
                    return;
                }

                const productData =
                    item.productId;

                if (!productData) {
                    return;
                }

                const categoryData =
                    productData.category;

                if (!categoryData) {
                    return;
                }

                const categoryId =
                    String(categoryData._id);

                const categoryName =
                    categoryData.name ||
                    "Unknown Category";

                if (!categoryStats[categoryId]) {
                    categoryStats[categoryId] = {
                        categoryName,

                        orders: 0,

                        revenue: 0
                    };
                }

                const quantity =
                    Number(item.quantity) || 0;

                const price =
                    Number(item.price) || 0;

                categoryStats[categoryId].orders++;

                categoryStats[categoryId].revenue +=
                    price * quantity;
            });
        });

        const topCategories =
            Object.values(categoryStats)
                .sort((a, b) =>
                    b.revenue - a.revenue
                )
                .slice(0, 10);

        // =========================================================
        // 20. TOP CUSTOMERS
        // =========================================================

        const customerStats = {};

        filteredOrders.forEach((order) => {

            const user =
                order.userId;

            if (!user) {
                return;
            }

            const userId =
                String(user._id);

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

                    // Cancelled/returned items should
                    // not be counted as customer spending.
                    if (!isActiveProduct(item)) {
                        return;
                    }

                    orderAmount +=
                        getItemAmount(item);
                });
            }

            // Only count order if it contains
            // at least one active item.
            if (orderAmount <= 0) {
                return;
            }

            customerStats[userId].orders++;

            customerStats[userId].spent +=
                orderAmount;
        });

        const topCustomers =
            Object.values(customerStats)
                .sort((a, b) =>
                    b.spent - a.spent
                )
                .slice(0, 10);

        // =========================================================
        // 21. REVENUE CHART
        // =========================================================
        //
        // Revenue for each date:
        //
        // Product sales
        //      -
        // Completed refunds
        //
        // Refund is assigned to the original order date.
        //
        // =========================================================

        const revenueByDate = {};

        filteredOrders.forEach((order) => {

            if (!order.createdAt) {
                return;
            }

            const date =
                new Date(order.createdAt)
                    .toISOString()
                    .split("T")[0];

            let grossAmount = 0;

            let refundedAmount = 0;

            if (Array.isArray(order.products)) {

                order.products.forEach((item) => {

                    // Gross sale
                    grossAmount +=
                        getItemAmount(item);

                    // Completed refund
                    if (isCompletedRefund(item)) {
                        refundedAmount +=
                            Number(item.refundAmount) || 0;
                    }
                });
            }

            const netAmount =
                Math.max(
                    0,
                    grossAmount - refundedAmount
                );

            revenueByDate[date] =
                (revenueByDate[date] || 0) + netAmount;
        });

        const salesChart =
            Object.entries(revenueByDate)
                .map(([date, amount]) => {
                    return {
                        date,
                        amount
                    };
                })
                .sort((a, b) =>
                    new Date(a.date) -
                    new Date(b.date)
                );

        // =========================================================
        // 22. ORDERS CHART
        // =========================================================

        const ordersByDate = {};

        filteredOrders.forEach((order) => {

            if (!order.createdAt) {
                return;
            }

            const date =
                new Date(order.createdAt)
                    .toISOString()
                    .split("T")[0];

            ordersByDate[date] =
                (ordersByDate[date] || 0) + 1;
        });

        const ordersChart =
            Object.entries(ordersByDate)
                .map(([date, count]) => ({
                    date,
                    count
                }))
                .sort((a, b) =>
                    new Date(a.date) -
                    new Date(b.date)
                );


                
        // =========================================================
        // 23. SALES ORDERS TABLE + PAGINATION
        // =========================================================

        const salesOrders = filteredOrders.map((order) => {
            const products = Array.isArray(order.products)
                ? order.products
                : [];

            const items = products.reduce((sum, item) => {
                if (!isActiveProduct(item)) return sum;
                return sum + (Number(item.quantity) || 0);
            }, 0);

            const amount = products.reduce((sum, item) => {
                if (!isActiveProduct(item)) return sum;
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

        const limit = 10;

        const totalSalesOrders = salesOrders.length;

        const totalPages = Math.ceil(
            totalSalesOrders / limit
        );

        const requestedPage = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const currentPage = Math.min(
            requestedPage,
            Math.max(totalPages, 1)
        );

        const paginatedSalesOrders = salesOrders.slice(
            (currentPage - 1) * limit,
            currentPage * limit
        );


        res.render(
            "admin/sales-report",
            {
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
            }
        );

    } catch (error) {

        console.error(
            "Sales report error:",
            error
        );

        res.status(500).send(
            "Failed to load sales report"
        );
    }
};

export default loadSalesReport;