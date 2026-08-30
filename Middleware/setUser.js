import User from "../Model/userModel.js";

export const setUser = async (req, res, next) => {
    try {

        res.locals.user = null;

        if (req.session.user) {

            const user = await User.findById(req.session.user);

            if (user) {
                res.locals.user = user;
            }

        }

        next();

    } catch (error) {
        next(error);
    }
};