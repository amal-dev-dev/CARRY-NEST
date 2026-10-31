import Order from "../../Model/orderModel.js";

const loadWallet = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const skip = (page - 1) * limit;

        // Get all orders with user details
        const orders = await Order.find({})
            .populate("userId")
            .sort({ createdAt: -1 });

        // Search by user name
        let filteredOrders = orders;

        if (search) {
            filteredOrders = orders.filter(order =>
                order.userId?.name
                    ?.toLowerCase()
                    .includes(search.toLowerCase())
            );
        }

        // Total transactions after search
        const totalTransactions = filteredOrders.length;

        // Total pages
        const totalPages = Math.ceil(totalTransactions / limit);

        // Calculate revenue
        let revenue = 0;

        filteredOrders.forEach(order => {

            if (
                order.paymentMethod === "RAZORPAY" &&
                order.paymentStatus === "completed"
            ) {
                revenue += Number(order.totalAmount || 0);
            }

        });

        // Refunds due
        const refundsDue = filteredOrders.filter(order =>
            order.orderStatus === "return_requested"
        ).length;

        // Create transaction data
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

                type: type,

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
            skip + limit
        );

        return res.render("admin/wallet", {

            search,
            totalTransactions,
            revenue,
            refundsDue,
            transactions,
            currentPage: page,
            totalPages

        });

    } catch (error) {

        console.error("Admin wallet error:", error);

        return res.status(500).send("Something went wrong");
    }
};


export {
    loadWallet
};