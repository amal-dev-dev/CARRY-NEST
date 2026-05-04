import express from 'express';
const router = express.Router();

import userLogin from '../../Controller/user/login.js';
import userSignup from '../../Controller/user/signup.js';
import authController from '../../Controller/user/forgotPassword.js';

import { requireAuth, isLoggedIn } from '../../Middleware/userAuth.js';
import { otpLimiter } from '../../Middleware/otpLimiter.js'; 

router.get('/login', isLoggedIn, userLogin.loadLogin);
router.post('/login', userLogin.login);

router.get('/signup', isLoggedIn, userSignup.loadSignup);
router.post('/signup', userSignup.signup);

router.get('/home', requireAuth, userLogin.loadHome);

router.get('/verify-otp', (req, res) => {
    res.render('user/verify-otp');
});

router.post('/verify-otp', userSignup.verifyOTP);


router.get("/forgot-password", authController.loadForgotPassword);
router.post("/forgot-password", otpLimiter, authController.forgotPassword);

router.get("/verify-otp", authController.loadVerifyOTP);
router.post("/verify-otp", authController.verifyOTP);

router.get("/reset-password", authController.loadResetPassword);
router.post("/reset-password", authController.resetPassword);


export default router;