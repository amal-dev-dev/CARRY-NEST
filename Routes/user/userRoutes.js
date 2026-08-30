import express from 'express';
const router = express.Router();
import userAuth from '../../Controller/user/auth.js';
import profileController from '../../Controller/user/profile.js';
import addressController from '../../Controller/user/address.js';
import changePasswordController from '../../Controller/user/change-password.js';
import { requireAuth, isLoggedIn } from '../../Middleware/userAuth.js';
import upload from '../../Middleware/multer.js';
import productController from '../../Controller/user/products.js';
import cartController from '../../Controller/user/cart.js';
import wishlistController from '../../Controller/user/wishlist.js';
import checkoutController from '../../Controller/user/checkout.js';
import orderController from '../../Controller/user/order.js';
import invoiceController from "../../Controller/user/invoiceController.js";


router.get('/login', isLoggedIn, userAuth.loadLogin);
router.post('/login', userAuth.login);
router.get('/logout', userAuth.logout);

router.get('/signup', isLoggedIn, userAuth.loadSignup);
router.post('/signup', userAuth.signup);

router.get('/home', userAuth.loadHome);

router.get('/signup-otp', userAuth.loadVerifyOTP);
router.post('/signup/otp', userAuth.verifyOTP);
router.post('/resend-otp', userAuth.resendOTP);

router.get('/forgot-password', userAuth.loadForgotPassword);
router.post('/forgot-password', userAuth.forgotPassword);
router.get('/forgot-otp', userAuth.forgot_loadVerifyOTP);
router.post('/forgot-otp', userAuth.forgot_verifyOTP);
router.get('/reset-password', userAuth.loadResetPassword);
router.post('/reset-password', userAuth.resetPassword);
router.post('/forgot/resend-otp', userAuth.forgot_resendOTP);

// PROFILE
router.get('/profile', requireAuth, profileController.loadProfile);

//EDIT PROFILE
router.get('/profile/edit', requireAuth, profileController.loadEditProfile);
router.post('/profile/edit', requireAuth, upload.single('profileImage'), profileController.updateProfile);

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
router.post("/address/delete/:id", requireAuth, addressController.deleteAddress);

// CAHNGE PASSWORD
router.get("/change-password", requireAuth, changePasswordController.loadChangePassword);
router.post("/change-password", requireAuth, changePasswordController.changePassword);

//PRODUCT PAGE
router.get('/products', productController.loadProducts);

// PRODUCT DETAILS
router.get("/product-details/:id", requireAuth, productController.loadProductDetails);

//CART
router.post("/add-to-cart", requireAuth, cartController.addToCart);
router.get("/cart", requireAuth, cartController.loadCart);
router.patch("/cart/increase/:id",requireAuth, cartController.increaseQuantity);
router.patch("/cart/decrease/:id",requireAuth, cartController.decreaseQuantity);
router.patch("/cart/remove/:id",requireAuth, cartController.removeCartItem);

//WISHLIST
router.get('/wishlist', requireAuth, wishlistController.loadWishlist);
router.post('/wishlist/toggle/:id',requireAuth, wishlistController.toggleWishlist);
router.patch("/wishlist/remove/:id", requireAuth, wishlistController.removeWishlist);
router.post( "/wishlist/move-all", requireAuth, wishlistController.moveAllToCart);

//CHECKOUT
router.get('/checkout', requireAuth, checkoutController.loadCheckout);
router.get("/checkout/add-address", requireAuth, checkoutController.loadAddAddressFromCheckout);
router.post("/checkout/add-address", requireAuth, checkoutController.addAddressFromCheckout);


router.post("/placeOrder", requireAuth, checkoutController.orderPlaced);

//ORDER
router.get('/orders', requireAuth, orderController.loadOrder);
router.get('/order-details/:id',requireAuth, orderController.loadOrderDetails);

router.post("/orders/:orderId/cancel", requireAuth, orderController.cancelOrder);
router.post("/orders/:orderId/products/:productId/cancel", requireAuth, orderController.cancelSingleProduct);

router.post("/orders/:orderId/return", requireAuth, orderController.returnOrder);
router.post("/orders/:orderId/products/:productId/return", requireAuth, orderController.returnSingleProduct);

router.get("/orders/:orderId/invoice", requireAuth, invoiceController.downloadInvoice);



export default router;