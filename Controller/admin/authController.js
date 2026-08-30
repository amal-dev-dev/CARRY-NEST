import Users from "../../Model/userModel.js";
import Admin from "../../Model/adminModel.js";
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

        const totalPages = Math.ceil(totalUsers / limit);


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
    loadDashboard,
    blockUser,
    unblockUser,
    loadCustomers,
    logout

};