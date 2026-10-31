import User from "../../Model/userModel.js";
import Product from "../../Model/productModel.js";
import Order from "../../Model/orderModel.js";

const loadDashboard = async (req, res) => {
    try {

        // Total customers
        const activeCustomers = await User.countDocuments({
            isBlocked: false
        });

        // Total orders
        const totalOrders = await Order.countDocuments();

        // Pending orders
        const pendingOrders = await Order.countDocuments({
            orderStatus: "pending"
        });

        // Low stock products
        const products = await Product.find({
            isBlocked: false
        });

        let lowStockProducts = [];

        products.forEach(product => {

            product.variants.forEach(variant => {

                if (variant.stock <= 5) {

                    lowStockProducts.push({
                        productName: product.productName,
                        stock: variant.stock
                    });

                }

            });

        });

        // Total revenue
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

        // Return requests
        const returnRequests = await Order.countDocuments({
            "products.returnStatus": "requested"
        });

        const pendingActions =
            pendingOrders +
            returnRequests +
            lowStockProducts.length;

        // Recent orders
        const recentOrders = await Order.find()
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .limit(5);

        const refundPending = await Order.countDocuments({
                "products.refundStatus": "pending"
            });

        res.render("admin/dashboard", {

            totalRevenue,
            totalOrders,
            activeCustomers,

            pendingActions,
            pendingOrders,
            returnRequests,
            refundPending,

            lowStockProducts,

            recentOrders

        });

    } catch (error) {

        console.log("ADMIN DASHBOARD ERROR:", error);

        res.redirect("/admin/pageNotFound");

    }
};

export default{ loadDashboard }