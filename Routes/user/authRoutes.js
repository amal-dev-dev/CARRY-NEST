import express from 'express';
import passport from '../../../CARRY_NEST/Config/passport.js';

const router = express.Router();

// Step 1 → Google login
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2 → Callback
router.get(
    "/google/callback",
    (req, res, next) => {

        passport.authenticate(
            "google",
            (err, user, info) => {

                if (err) {
                    return next(err);
                }

                if (!user) {

                    req.session.message =
                        info?.message || "Login failed";

                    return res.redirect("/user/login");
                }

                req.logIn(user, (err) => {

                    if (err) {
                        return next(err);
                    }

                    // IMPORTANT
                    req.session.user = user._id;

                    return res.redirect("/user/home");

                });

            }
        )(req, res, next);

    }
);

export default router;