import express from 'express';
import passport from '../../../CARRY_NEST/Config/passport.js';

const router = express.Router();

// Step 1 → Google login
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2 → Callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/user/login'
    }),
    (req, res) => {
        req.session.user = {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        };

        res.redirect('/user/home');
    }
);

export default router;