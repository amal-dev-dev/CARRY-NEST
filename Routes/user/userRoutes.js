import express from 'express';
const router = express.Router();

import userLogin from '../../Controller/user/login.js';
import userSignup from '../../Controller/user/signup.js';
import authController from '../../Controller/user/forgotPassword.js';

import { requireAuth, isLoggedIn } from '../../Middleware/userAuth.js';
import { otpLimiter } from '../../Middleware/otpLimiter.js'; 

// LOGIN
router.get('/login', isLoggedIn, userLogin.loadLogin);
router.post('/login', userLogin.login);

// SIGNUP
router.get('/signup', isLoggedIn, userSignup.loadSignup);
router.post('/signup', userSignup.signup);

// SIGNUP OTP
router.get('/signup/otp', userSignup.loadVerifyOTP);
router.post('/signup/otp', userSignup.verifyOTP);

// HOME
router.get('/home', requireAuth, userLogin.loadHome);

// FORGOT PASSWORD
router.get('/forgot-password', authController.loadForgotPassword);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);

// FORGOT PASSWORD OTP
router.get('/forgot-otp', authController.loadVerifyOTP);
router.post('/forgot-otp', authController.verifyOTP);

// RESET PASSWORD
router.get('/reset-password', authController.loadResetPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/signup-otp', userSignup.loadVerifyOTP);
router.post('/signup/otp', userSignup.verifyOTP);
router.post('/resend-otp', userSignup.resendOTP);

export default router;