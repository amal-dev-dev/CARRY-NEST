import User from "../Model/user/userModel.js";

// Protect private routes
export const requireAuth = async (req, res, next) => {

    if (!req.session.user) {
        return res.redirect('/user/login');
    }

    // CHECK USER BLOCKED OR NOT
    const user = await User.findById(req.session.user);

    // IF USER NOT FOUND OR BLOCKED
    if (!user || user.isBlocked) {

        // destroy session
        req.session.destroy(() => {

            res.clearCookie("connect.sid");

            return res.redirect('/user/login');
        });

        return;
    }

    next();
};

// Prevent logged-in users from accessing login/signup
export const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/user/home');
    }
    next();
};
