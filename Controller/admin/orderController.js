import orderService from "../../Service/admin/orderService.js";


const loadOrders = async (req, res) => {
    try {
        const search = req.query.search
            ? req.query.search.trim()
            : "";

        const page = parseInt(req.query.page) || 1;
        const status = req.query.status;

        const data = await orderService.getAdminOrders(
            search,
            page,
            status
        );

        return res.render("admin/orders", {
            orders: data.orders,
            search,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            totalOrders: data.totalOrders,
            status
        });

    } catch (error) {
        console.log("LOAD ADMIN ORDERS ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};



const loadOrderDetails = async (req, res) => {
    try {
        const order = await orderService.getAdminOrderDetails(
            req.params.id
        );

        if (!order) {
            return res.redirect("/admin/orders");
        }

        const successMessage = req.session.successMessage;
        const errorMessage = req.session.errorMessage;

        req.session.successMessage = null;
        req.session.errorMessage = null;

        return res.render("admin/order-details", {
            order,
            successMessage,
            errorMessage
        });

    } catch (error) {
        console.log("LOAD ADMIN ORDER DETAILS ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};


const loadReturnRequests = async (req, res) => {
    try {
        const data = await orderService.getReturnRequests();

        return res.render("admin/return-requests", {
            orders: data.orders,
            totalReturnRequests: data.totalReturnRequests
        });

    } catch (error) {
        console.log("LOAD RETURN REQUESTS ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};

const loadReturnRequestDetails = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const data = await orderService.getReturnRequestDetails(
            orderId,
            itemId
        );

        if (!data) {
            return res.redirect("/admin/return-requests");
        }

        return res.render("admin/return-request-details", {
            order: data.order,
            returnProduct: data.returnProduct
        });

    } catch (error) {
        console.log("LOAD RETURN REQUEST DETAILS ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};

const approveReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        await orderService.approveReturn(orderId, itemId);

        return res.redirect(
            `/admin/return-request-details/${orderId}/${itemId}`
        );

    } catch (error) {
        console.error("APPROVE RETURN ERROR:", error);
        return res.redirect("/admin/return-requests");
    }
};

const rejectReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        await orderService.rejectReturn(orderId, itemId);

        return res.redirect(
            `/admin/return-request-details/${orderId}/${itemId}`
        );

    } catch (error) {
        console.error("REJECT RETURN ERROR:", error);
        return res.redirect("/admin/return-requests");
    }
};


const updateProductStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { status } = req.body;

        const result = await orderService.updateProductStatus(
            orderId,
            itemId,
            status
        );

        if (!result.success) {
            req.session.errorMessage = result.message;

            return res.redirect(
                result.redirect || `/admin/order-details/${orderId}`
            );
        }

        req.session.successMessage =
            "Product status updated successfully.";

        return res.redirect(`/admin/order-details/${orderId}`);

    } catch (error) {

        console.error("UPDATE PRODUCT STATUS ERROR:", error);

        req.session.errorMessage =
            "Failed to update product status.";

        return res.redirect(
            `/admin/order-details/${req.params.orderId}`
        );
    }
};


const processRefund = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const result = await orderService.processRefund(
            orderId,
            itemId
        );

        if (!result.success) {
            req.session.errorMessage = result.message;

            return res.redirect(
                result.redirect || `/admin/order-details/${orderId}`
            );
        }

        req.session.successMessage =
            `Refund of ₹${result.refundAmount} credited to customer's wallet.`;

        return res.redirect(`/admin/order-details/${orderId}`);

    } catch (error) {

        console.error("PROCESS REFUND ERROR:", error);

        req.session.errorMessage =
            "Failed to process refund.";

        return res.redirect(
            `/admin/order-details/${req.params.orderId}`
        );
    }
};

export default {
    loadOrders,
    loadOrderDetails,
    updateProductStatus,
    loadReturnRequests,
    loadReturnRequestDetails,
    approveReturn,
    rejectReturn,
    processRefund
};