import User from "../Model/userModel.js";

export const setUser = async (req, res, next) => {
    try {
        
        if (req.user) {
            // Google login
            res.locals.user = req.user;

        } else if (req.session.user) {
            // Normal login
            const user = await User.findById(req.session.user);
            res.locals.user = user;

        } else {
            res.locals.user = null;
        }

        next();

    } catch (error) {
        next(error);
    }
};