import express from "express";
import adminController from "../../Controller/admin/authController.js";
import categoryController from "../../Controller/admin/categoryController.js"
import productController from "../../Controller/admin/productController.js";
import { adminAuth, adminLoggedIn }  from "../../Middleware/adminAuth.js";
import upload from "../../Middleware/multer.js";
import orderController from "../../Controller/admin/orderController.js";
import couponController from "../../Controller/admin/couponController.js";
import offerController from "../../Controller/admin/offerController.js";
import dashboardController from "../../Controller/admin/dashboardController.js"
import brandController from "../../Controller/admin/brandController.js";
import { loadWallet } from "../../Controller/admin/walletController.js";
import SalesReportController from "../../Controller/admin/salesReportController.js";
import { exportCSV, exportExcel, exportPDF } from "../../Controller/admin/salesReportExport.js";

const router = express.Router();

//LOGIN
router.get("/login", adminLoggedIn, adminController.loadLogin);
router.post("/login", adminController.login);

//DASHBORD
router.get("/dashboard", adminAuth, dashboardController.loadDashboard);

//COUSTOMERS
router.get("/customers", adminAuth, adminController.loadCustomers);
router.get("/block-user/:id", adminAuth, adminController.blockUser);
router.get("/unblock-user/:id", adminAuth, adminController.unblockUser);

//LOGOUT
router.get("/logout", adminAuth, adminController.logout);

//CATEGORY
router.get("/category",adminAuth, categoryController.loadCategory);
router.get("/add-category", adminAuth, categoryController.loadAddCategory);
router.post("/add-category", adminAuth, categoryController.addCategory);
router.get("/edit-category/:id", adminAuth, categoryController.loadEditCategory);
router.patch("/category/:id", adminAuth, categoryController.editCategory);
router.patch("/category/:id/list", adminAuth, categoryController.listCategory);
router.patch("/category/:id/unlist", adminAuth, categoryController.unlistCategory);

//PRODUCTS
router.get("/products", adminAuth, productController.loadProducts);
router.get("/add-product", adminAuth, productController.loadAddProduct);
router.post("/add-product", adminAuth, upload.array("images",4), productController.addProduct)
router.get("/edit-product/:id", adminAuth, productController.loadEditProduct);
router.patch("/products/:id", adminAuth, upload.array("images", 4), productController.editProduct);
router.patch("/products/:id/block", adminAuth, productController.blockProduct);
router.patch("/products/:id/unblock", adminAuth, productController.unblockProduct);

//ORDER
router.get("/orders", adminAuth, orderController.loadOrders);
router.get("/order-details/:id", adminAuth, orderController.loadOrderDetails);
router.post("/order/:orderId/product/:itemId", adminAuth, orderController.updateProductStatus);

// Return Approval
router.get("/return-requests", adminAuth, orderController.loadReturnRequests);
router.get("/return-request-details/:orderId", adminAuth, orderController.loadReturnRequestDetails);
router.post("/return-requests/:orderId/approve", adminAuth, orderController.approveReturn);     
router.post("/return-requests/:orderId/reject", adminAuth, orderController.rejectReturn);
router.post("/orders/:orderId/items/:itemId/refund", adminAuth, orderController.processRefund);

// COUPON
router.get("/coupons", adminAuth, couponController.loadCoupons);
router.get("/coupons/add", adminAuth, couponController.loadAddCoupon);
router.post("/coupons/add", adminAuth, couponController.addCoupon);
router.get( "/coupons/edit/:id", adminAuth, couponController.loadEditCoupon);
router.post("/coupons/edit/:id", adminAuth, couponController.updateCoupon);
router.patch("/coupons/toggle/:id", adminAuth, couponController.toggleCouponStatus);
router.delete("/coupons/delete/:id", adminAuth, couponController.deleteCoupon);

//OFFER
router.get("/offers", adminAuth, offerController.loadOffers);
router.get("/add-offer", adminAuth, offerController.loadAddOffer);
router.post("/add-offer", adminAuth, offerController.addOffer);
router.get("/edit-offer/:id", adminAuth, offerController.loadEditOffer);
router.patch("/edit-offer/:id", adminAuth, offerController.editOffer);
router.patch("/offers/toggle/:id", adminAuth, offerController.toggleOfferStatus);
router.delete("/offers/delete/:id", adminAuth, offerController.deleteOffer);

// WALLET
router.get("/wallet", adminAuth, loadWallet);

// BRAND
router.get("/brands", adminAuth, brandController.loadBrands);
router.post("/brands/add", adminAuth, brandController.addBrand);
router.patch("/brands/edit/:id",adminAuth, brandController.updateBrand);
router.patch("/brands/toggle-status/:id", adminAuth, brandController.toggleBrandStatus);

//SALES REPORTS
router.get("/sales-report", adminAuth, SalesReportController);
router.get("/sales-report/export/csv", adminAuth, exportCSV);
router.get("/sales-report/export/excel", adminAuth, exportExcel);
router.get("/sales-report/export/pdf", adminAuth, exportPDF);


export default router;