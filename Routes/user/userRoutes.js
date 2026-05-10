import express from 'express';
const router = express.Router();
import userLogin from '../../Controller/user/login.js';
import userSignup from '../../Controller/user/signup.js';
import userForgotPassword from '../../Controller/user/forgotPassword.js';
import { requireAuth, isLoggedIn } from '../../Middleware/userAuth.js';

router.get('/login', isLoggedIn, userLogin.loadLogin);
router.post('/login', userLogin.login);

router.get('/signup', isLoggedIn, userSignup.loadSignup);
router.post('/signup', userSignup.signup);

router.get('/home', requireAuth, userLogin.loadHome);

router.get('/signup-otp', userSignup.loadVerifyOTP);
router.post('/signup/otp', userSignup.verifyOTP);
router.post('/resend-otp', userSignup.resendOTP);

router.get('/forgot-password', userForgotPassword.loadForgotPassword);
router.post('/forgot-password', userForgotPassword.forgotPassword);
router.get('/forgot-otp', userForgotPassword.loadVerifyOTP);
router.post('/forgot-otp', userForgotPassword.verifyOTP);
router.get('/reset-password', userForgotPassword.loadResetPassword);
router.post('/reset-password', userForgotPassword.resetPassword);
router.post('/forgot/resend-otp', userForgotPassword.resendOTP);

export default router;