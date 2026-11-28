
import Order from "../../Model/orderModel.js";

const getWalletData = async ({ search = "", page = 1, limit = 10 }) => {
    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Number(limit) || 10);
    const skip = (currentPage - 1) * pageLimit;

    // Get all orders with user details
    const orders = await Order.find({})
        .populate("userId")
        .sort({ createdAt: -1 })
        .lean();

    // Search by customer name
    let filteredOrders = orders;

    if (search) {
        const searchText = search.toLowerCase();

        filteredOrders = orders.filter(order =>
            order.userId?.name
                ?.toLowerCase()
                .includes(searchText)
        );
    }

    // Total transactions after search
    const totalTransactions = filteredOrders.length;

    // Calculate total pages
    const totalPages = Math.ceil(totalTransactions / pageLimit);

    // Calculate Razorpay revenue
    const revenue = filteredOrders.reduce((total, order) => {
        if (
            order.paymentMethod === "RAZORPAY" &&
            order.paymentStatus === "completed"
        ) {
            return total + Number(order.totalAmount || 0);
        }

        return total;
    }, 0);

    // Calculate refunds awaiting processing
    const refundsDue = filteredOrders.filter(order =>
        order.orderStatus === "return_requested"
    ).length;

    // Prepare transaction data
    const allTransactions = filteredOrders.map(order => {
        let type = "Purchase";

        if (
            order.orderStatus === "cancelled" ||
            order.orderStatus === "return_requested"
        ) {
            type = "Refund";
        }

        return {
            _id: order._id,
            transactionId: order.orderId,
            user: order.userId,
            type,
            amount: Number(order.totalAmount || 0),
            status:
                order.orderStatus === "return_requested"
                    ? "Pending"
                    : "Success",
            createdAt: order.createdAt
        };
    });

    // Pagination
    const transactions = allTransactions.slice(
        skip,
        skip + pageLimit
    );

    return {
        search,
        totalTransactions,
        revenue,
        refundsDue,
        transactions,
        currentPage,
        totalPages
    };
};

export default {
    getWalletData
};
