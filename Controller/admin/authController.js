import Users from "../../Model/userModel.js";
import Admin from "../../Model/adminModel.js";
import Order from "../../Model/orderModel.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

const loadLogin = (req, res) => {
    res.render("admin/login", {
        message: null
    });
};

const login = async (req, res) => {
    try {

        const { email, password } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ email });

        if(!email && !password) {
            return res.render("admin/login", {
                message: "Please ender email and password"
            });
        }

        if(!password) {
            return res.render("admin/login", {
                message: "Please ender password"
            })
        }

        if (!admin) {
            return res.render("admin/login", {
                message: "Invalid admin credentials"
            });
        }

        // Compare entered password with hashed password
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.render("admin/login", {
                message: "Invalid admin credentials"
            });
        }

        req.session.admin = admin._id;


        req.session.save((err) => {

            if (err) {
                console.log(err);
                return res.render("admin/login", {
                    message: "Login failed"
                });
            }

            res.redirect("/admin/dashboard");

        });

    } catch (error) {
        console.log("ADMIN LOGIN ERROR:", error);

        res.render("admin/login", {
            message: "Something went wrong"
        });
    }
};


const blockUser = async (req, res) => {

    try {

        await Users.findByIdAndUpdate(req.params.id, {

            isBlocked: true

        });

        res.redirect("/admin/customers");

    } catch (error) {

        console.log(error);

    }

};

const unblockUser = async (req, res) => {

    try {

        await Users.findByIdAndUpdate(req.params.id, {

            isBlocked: false

        });

        res.redirect("/admin/customers");

    } catch (error) {

        console.log(error);

    }

};


const loadCustomers = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const sort = req.query.sort === "oldest" ? "oldest" : "latest";

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = 5;
        const skip = (page - 1) * limit;

        // Escape special characters in the search input
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

        // Fetch customers for the current page
        const users = await Users.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalUsers = await Users.countDocuments(filter);

        const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

        // Overall customer statistics (not affected by search)
        const [activeCustomers, blockedCustomers] = await Promise.all([
            Users.countDocuments({ isBlocked: { $ne: true } }),
            Users.countDocuments({ isBlocked: true })
        ]);

        // Get orders belonging to the customers on this page
        const userIds = users.map(user => user._id);

        const orders = userIds.length
            ? await Order.find({ userId: { $in: userIds } })
                .select("userId totalAmount paymentStatus orderStatus paymentMethod")
                .lean()
            : [];

        // Calculate order count and spending per customer
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

            // Count successfully paid orders.
            // COD orders count as spent once delivered.
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

        // Attach statistics to each customer for EJS
        const customers = users.map(user => ({
            ...user,
            orderCount: customerStats[user._id.toString()].orderCount,
            totalSpent: customerStats[user._id.toString()].totalSpent
        }));

        return res.render("admin/customers", {
            users: customers,
            search,
            sort,
            currentPage: page,
            totalPages,
            totalUsers,
            activeCustomers,
            blockedCustomers
        });

    } catch (error) {
        console.error("LOAD CUSTOMERS ERROR:", error);
        return res.status(500).send("Unable to load customers");
    }
};


const logout = (req, res) => {

    delete req.session.admin;

    req.session.save((err) => {

        if (err) {
            console.log(err);
            return res.redirect("/admin/dashboard");
        }

        res.redirect("/admin/login");

    });

};

export default {

    loadLogin,
    login,
    blockUser,
    unblockUser,
    loadCustomers,
    logout

};