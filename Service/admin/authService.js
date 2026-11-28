
import Users from "../../Model/userModel.js";
import Admin from "../../Model/adminModel.js";
import Order from "../../Model/orderModel.js";
import bcrypt from "bcrypt";


const authenticateAdmin = async (email, password) => {

    if (!email && !password) {
        return {
            success: false,
            message: "Please enter email and password"
        };
    }

    if (!email) {
        return {
            success: false,
            message: "Please enter email"
        };
    }

    if (!password) {
        return {
            success: false,
            message: "Please enter password"
        };
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
        return {
            success: false,
            message: "Invalid admin credentials"
        };
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
        return {
            success: false,
            message: "Invalid admin credentials"
        };
    }

    return {
        success: true,
        adminId: admin._id
    };
};


const updateCustomerBlockStatus = async (userId, isBlocked) => {

    return await Users.findByIdAndUpdate(userId, {
        isBlocked
    });
};


const getCustomersPageData = async ({
    search = "",
    sort = "latest",
    page = 1,
    limit = 5
}) => {

    search = search.trim();

    page = Math.max(1, parseInt(page, 10) || 1);

    const skip = (page - 1) * limit;

    // Escape special characters in search input
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    // Search by name, email, or phone
    const filter = search
        ? {
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex }
            ]
        }
        : {};

    const sortOption = {
        createdAt: sort === "latest" ? -1 : 1,
        _id: -1
    };

    // Fetch customers for current page
    const users = await Users.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalUsers = await Users.countDocuments(filter);

    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

    // Overall customer statistics
    const [activeCustomers, blockedCustomers] = await Promise.all([
        Users.countDocuments({ isBlocked: { $ne: true } }),
        Users.countDocuments({ isBlocked: true })
    ]);

    // Get orders belonging to customers on this page
    const userIds = users.map(user => user._id);

    const orders = userIds.length
        ? await Order.find({ userId: { $in: userIds } })
            .select("userId totalAmount paymentStatus orderStatus paymentMethod")
            .lean()
        : [];

    // Calculate customer statistics
    const customerStats = {};

    for (const user of users) {
        customerStats[user._id.toString()] = {
            orderCount: 0,
            totalSpent: 0
        };
    }

    for (const order of orders) {

        const customerId = order.userId?.toString();

        if (!customerId || !customerStats[customerId]) {
            continue;
        }

        // Exclude cancelled and failed orders from order count
        const excludedStatuses = [
            "cancelled",
            "payment_failed"
        ];

        const excludedPayments = ["failed"];

        if (
            excludedStatuses.includes(order.orderStatus) ||
            excludedPayments.includes(order.paymentStatus)
        ) {
            continue;
        }

        customerStats[customerId].orderCount++;

        // Calculate successfully paid spending
        // COD counts as spent only after delivery
        const isPaid =
            order.paymentStatus === "completed" ||
            (
                order.paymentMethod === "COD" &&
                order.orderStatus === "delivered"
            );

        if (isPaid) {
            customerStats[customerId].totalSpent +=
                Number(order.totalAmount) || 0;
        }
    }

    // Attach statistics to customers
    const customers = users.map(user => ({
        ...user,
        orderCount: customerStats[user._id.toString()].orderCount,
        totalSpent: customerStats[user._id.toString()].totalSpent
    }));

    return {
        customers,
        search,
        sort,
        currentPage: page,
        totalPages,
        totalUsers,
        activeCustomers,
        blockedCustomers
    };
};


export default {
    authenticateAdmin,
    updateCustomerBlockStatus,
    getCustomersPageData
};
