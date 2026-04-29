// Protect private routes
export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/user/login');
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

export default {
    requireAuth,
    isLoggedIn
}