
import authService from "../../Service/admin/authService.js";


const loadLogin = (req, res) => {
    res.render("admin/login", {
        message: null
    });
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await authService.authenticateAdmin(
            email,
            password
        );

        if (!result.success) {
            return res.render("admin/login", {
                message: result.message
            });
        }

        req.session.admin = result.adminId;

        req.session.save((err) => {
            if (err) {
                console.error("ADMIN SESSION ERROR:", err);

                return res.render("admin/login", {
                    message: "Login failed"
                });
            }

            return res.redirect("/admin/dashboard");
        });

    } catch (error) {
        console.error("ADMIN LOGIN ERROR:", error);

        return res.render("admin/login", {
            message: "Something went wrong"
        });
    }
};


const blockUser = async (req, res) => {
    try {
        await authService.updateCustomerBlockStatus(
            req.params.id,
            true
        );

        return res.redirect("/admin/customers");

    } catch (error) {
        console.error("BLOCK USER ERROR:", error);

        return res.redirect("/admin/customers");
    }
};


const unblockUser = async (req, res) => {
    try {
        await authService.updateCustomerBlockStatus(
            req.params.id,
            false
        );

        return res.redirect("/admin/customers");

    } catch (error) {
        console.error("UNBLOCK USER ERROR:", error);

        return res.redirect("/admin/customers");
    }
};


const loadCustomers = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();

        const sort = req.query.sort === "oldest"
            ? "oldest"
            : "latest";

        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const data = await authService.getCustomersPageData({
            search,
            sort,
            page,
            limit: 5
        });

        return res.render("admin/customers", {
            users: data.customers,
            search: data.search,
            sort: data.sort,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            totalUsers: data.totalUsers,
            activeCustomers: data.activeCustomers,
            blockedCustomers: data.blockedCustomers
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
            console.error("ADMIN LOGOUT ERROR:", err);

            return res.redirect("/admin/dashboard");
        }

        return res.redirect("/admin/login");
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
