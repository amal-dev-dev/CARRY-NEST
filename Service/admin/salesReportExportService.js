
import Order from "../../Model/orderModel.js";

// =========================================
// GET SALES DATA
// =========================================
const getSalesData = async (req) => {
    const {
        status,
        payment,
        category,
        product
    } = req.query;

    const period = req.query.period || "30";

    let startDate = new Date();
    let endDate = new Date();

    // =========================================
    // CUSTOM DATE RANGE
    // =========================================
    if (period === "custom") {
        const customStart = new Date(req.query.startDate);
        const customEnd = new Date(req.query.endDate);

        if (
            !req.query.startDate ||
            !req.query.endDate ||
            isNaN(customStart.getTime()) ||
            isNaN(customEnd.getTime())
        ) {
            throw new Error("Invalid custom date range.");
        }

        if (customStart > customEnd) {
            throw new Error("Start date must be before end date.");
        }

        customStart.setHours(0, 0, 0, 0);
        customEnd.setHours(23, 59, 59, 999);

        startDate = customStart;
        endDate = customEnd;
    }

    // =========================================
    // PRESET PERIODS
    // =========================================
    else {
        const periodNumber = Number(period);

        if (![7, 30, 90, 365].includes(periodNumber)) {
            throw new Error("Invalid sales report period.");
        }

        if (periodNumber === 365) {
            // Current year
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate.setDate(
                startDate.getDate() - periodNumber
            );

            startDate.setHours(0, 0, 0, 0);
        }
    }

    // =========================================
    // FETCH ORDERS
    // =========================================
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

    // =========================================
    // STATUS FILTER
    // =========================================
    if (status) {
        filteredOrders = filteredOrders.filter((order) =>
            String(order.orderStatus || "")
                .toLowerCase() === status.toLowerCase()
        );
    }

    // =========================================
    // PAYMENT FILTER
    // =========================================
    if (payment) {
        filteredOrders = filteredOrders.filter((order) =>
            String(order.paymentMethod || "")
                .toLowerCase() === payment.toLowerCase()
        );
    }

    // =========================================
    // CATEGORY FILTER
    // =========================================
    if (category) {
        filteredOrders = filteredOrders.filter((order) =>
            order.products.some((item) =>
                String(item.productId?.category?._id || "") ===
                String(category)
            )
        );
    }

    // =========================================
    // PRODUCT FILTER
    // =========================================
    if (product) {
        const search = product.toLowerCase().trim();

        filteredOrders = filteredOrders.filter((order) =>
            order.products.some((item) =>
                (item.productId?.productName || "")
                    .toLowerCase()
                    .includes(search)
            )
        );
    }

    return filteredOrders;
};


// =========================================
// CREATE EXPORT DATA
// =========================================
const createExportData = (orders) => {
    const data = [];

    orders.forEach((order) => {
        if (!Array.isArray(order.products)) {
            return;
        }

        order.products.forEach((item) => {
            const product = item.productId;

            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;

            data.push({
                OrderID: order.orderId || "",

                Date: order.createdAt
                    ? new Date(order.createdAt)
                        .toLocaleDateString("en-IN")
                    : "",

                Customer:
                    order.userId?.name ||
                    order.userId?.fullName ||
                    order.userId?.username ||
                    order.userId?.email ||
                    "Unknown",

                Product:
                    product?.productName ||
                    "Unknown Product",

                Category:
                    product?.category?.name ||
                    "Unknown Category",

                Quantity: quantity,

                Price: price,

                Total: price * quantity,

                Payment:
                    order.paymentMethod || "",

                PaymentStatus:
                    order.paymentStatus || "",

                OrderStatus:
                    order.orderStatus || ""
            });
        });
    });

    return data;
};


// =========================================
// GET REPORT PERIOD
// =========================================
const getReportPeriod = (req) => {
    const period = req.query.period || "30";

    if (
        period === "custom" &&
        req.query.startDate &&
        req.query.endDate
    ) {
        return `${req.query.startDate} to ${req.query.endDate}`;
    }

    const periodLabels = {
        "7": "Last 7 Days",
        "30": "Last 30 Days",
        "90": "Last 90 Days",
        "365": "Current Year"
    };

    return periodLabels[period] || "Last 30 Days";
};


// =========================================
// EXPORT SERVICE METHODS
// =========================================
export default {
    getSalesData,
    createExportData,
    getReportPeriod
};
