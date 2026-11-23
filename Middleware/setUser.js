
import User from "../Model/userModel.js";

export const setUser = async (req, res, next) => {
    try {
        res.locals.user = null;

        if (!req.session?.user) {
            return next();
        }

        const user = await User.findById(req.session.user);

        // User not found or blocked
        if (!user || user.isBlocked) {
            return req.session.destroy((error) => {
                if (error) {
                    return next(error);
                }

                res.clearCookie("user.sid", { path: "/" });
                res.locals.user = null;

                return next();
            });
        }

        res.locals.user = user;

        return next();

    } catch (error) {
        console.error("setUser middleware error:", error);
        return next(error);
    }
};
