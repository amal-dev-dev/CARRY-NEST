import User from "../Model/userModel.js";

export const requireAuth = async (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
        if (!req.session.user) {
            return res.redirect('/user/login');
        }

        const user = await User.findById(req.session.user);

        if (!user || user.isBlocked) {
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                return res.redirect('/user/login');
            });
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).send('Something went wrong. Please try again.');
    }
};

export const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/user/home');
    }

    next();
};
