import dashboardService from "../../Service/admin/dashboardService.js";

const loadDashboard = async (req, res) => {
    try {

        // Get selected analytics date filter
        const period = req.query.period || "30";

        const customStartDate = req.query.startDate;

        const customEndDate = req.query.endDate;

        // Get dashboard data from service
        const result = await dashboardService.getDashboardData({
            period,
            customStartDate,
            customEndDate
        });

        // Handle validation errors
        if (!result.success) {
            return res.status(400).send(result.message);
        }

        // Render dashboard
        res.render("admin/dashboard", {

            totalRevenue: result.totalRevenue,
            totalOrders: result.totalOrders,
            totalProducts: result.totalProducts,
            activeCustomers: result.activeCustomers,
            pendingActions: result.pendingActions,

            pendingOrders: result.pendingOrders,
            returnRequests: result.returnRequests,
            refundPending: result.refundPending,
            pendingRefundOrderId: result.pendingRefundOrderId,
            cancellationRefundPending: result.cancellationRefundPending,

            lowStockProducts: result.lowStockProducts,
            recentOrders: result.recentOrders,

            // Analytics data
            salesChart: result.salesChart,
            ordersChart: result.ordersChart,
            statusOrders: result.statusOrders,
            topProducts: result.topProducts,

            // Selected date filter
            period: result.period,
            startDateInput: result.startDateInput,
            endDateInput: result.endDateInput

        });

    } catch (error) {

        console.error("ADMIN DASHBOARD CONTROLLER ERROR:", error);

        res.redirect("/admin/pageNotFound");

    }
};

export default {
    loadDashboard
};