import Users from "../../Model/user/userModel.js";
import dotenv from "dotenv";

dotenv.config();

const loadLogin = (req, res) => {
    res.render("admin/login", {
        message: null
    });
};

const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
            return res.render('admin/login', { message: "Invalid admin credentials" });
        }

        if(!email && !password){
            return res.render('admin/login',{ message: "Email and Password Required"});
        }

        if(!email) {
            return res.render('admin/login',{ message: "Email Required"});
        }

        if(!password){
            return res.render('admin/login',{ message: "Password Required"});
        }

        req.session.admin = true;
        res.redirect("/admin/dashboard");

    } catch (error) {

        console.log(error);
    }
};

const loadDashboard = async (req, res) => {

    try {

        const search = req.query.search || "";

        const page = parseInt(req.query.page) || 1;

        const limit = 5;

        const skip = (page - 1) * limit;

        const users = await Users.find({

            name: {
                $regex: search,
                $options: "i"
            }

        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalUsers = await Users.countDocuments({

            name: {
                $regex: search,
                $options: "i"
            }

        });

        const totalPages = Math.ceil(totalUsers / limit);

        res.render("admin/dashboard", {

            users,
            currentPage: page,
            totalPages,
            search

        });

    } catch (error) {

        console.log(error);

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

        const search = req.query.search || "";

        const sort = req.query.sort || "latest";

        const page = parseInt(req.query.page) || 1;

        const limit = 5;

        const skip = (page - 1) * limit;

        let sortOption = {};

        // SORTING
        if(sort === "latest"){

            sortOption = { createdAt: -1 };

        } else if(sort === "oldest"){

            sortOption = { createdAt: 1 };

        }

        const users = await Users.find({

            name: {
                $regex: search,
                $options: "i"
            }

        })
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

        const totalUsers = await Users.countDocuments({

            name: {
                $regex: search,
                $options: "i"
            }

        });

        const totalPages =
        Math.ceil(totalUsers / limit);

        res.render("admin/customers", {

            users,
            search,
            sort,
            currentPage: page,
            totalPages,
            totalUsers

        });

    } catch (error) {

        console.log(error);

    }

};

 const logout = (req, res) => {

    req.session.destroy((err) => {

        if(err){

            console.log(err);

            return res.redirect("/admin/dashboard");

        }

        res.clearCookie("connect.sid");

        return res.redirect("/admin/login");

    });

};

export default {

    loadLogin,
    login,
    loadDashboard,
    blockUser,
    unblockUser,
    loadCustomers,
    logout

};