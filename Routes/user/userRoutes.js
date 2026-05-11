import express from 'express';
const router = express.Router();
import userLogin from '../../Controller/user/login.js';
import userSignup from '../../Controller/user/signup.js';
import profileController from '../../Controller/user/profile.js';
import addressController from '../../Controller/user/address.js';

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

// PROFILE
router.get('/profile', requireAuth, profileController.loadProfile);

//EDIT PROFILE
router.get('/profile/edit', requireAuth, profileController.loadEditProfile);
router.post('/profile/edit', requireAuth, profileController.updateProfile);

// EMAIL UPDATE OTP
router.get("/change-email", profileController.loadEmailChangePage);
router.post("/send-email-otp", profileController.sendEmailOTP);
router.post("/verify-email-otp", profileController.verifyEmailOTP);

// ADDRESS PAGE
router.get("/address", requireAuth, addressController.loadAddress);

// ADD ADDRESS
router.get("/address/add", requireAuth, addressController.loadAddAddress);
router.post("/address/add", requireAuth, addressController.addAddress);

// EDIT ADDRESS
router.get("/address/edit/:id", requireAuth, addressController.loadEditAddress);
router.post("/address/edit/:id", requireAuth, addressController.updateAddress);

// DELETE ADDRESS
router.get("/address/delete/:id", requireAuth, addressController.deleteAddress);


export default router;