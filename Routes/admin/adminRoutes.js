import express from "express";
import adminController from "../../Controller/admin/authController.js";
import categoryController from "../../Controller/admin/categoryController.js"
import productController from "../../Controller/admin/productController.js";
import { adminAuth, adminLoggedIn }  from "../../Middleware/adminAuth.js";
import upload from "../../Middleware/multer.js"

const router = express.Router();

router.get("/login", adminLoggedIn, adminController.loadLogin);
router.post("/login", adminController.login);

router.get("/dashboard", adminAuth, adminController.loadDashboard);

router.get("/customers", adminAuth, adminController.loadCustomers);
router.get("/block-user/:id", adminAuth, adminController.blockUser);
router.get("/unblock-user/:id", adminAuth, adminController.unblockUser);

router.get("/logout", adminAuth, adminController.logout);

router.get("/category",adminAuth, categoryController.loadCategory);
router.get("/add-category", adminAuth, categoryController.loadAddCategory);
router.post("/add-category", adminAuth, categoryController.addCategory);
router.get("/edit-category/:id", adminAuth, categoryController.loadEditCategory);
router.patch("/category/:id", adminAuth, categoryController.editCategory);
router.patch("/category/:id/list", adminAuth, categoryController.listCategory);
router.patch("/category/:id/unlist", adminAuth, categoryController.unlistCategory);

router.get("/products", adminAuth, productController.loadProducts);
router.get("/add-product", adminAuth, productController.loadAddProduct);
router.post("/add-product", adminAuth, upload.array("images",4), productController.addProduct)
router.get("/edit-product/:id", adminAuth, productController.loadEditProduct);
router.patch("/products/:id", adminAuth, upload.array("images", 4), productController.editProduct);
router.patch("/products/:id/block", adminAuth, productController.blockProduct);
router.patch("/products/:id/unblock", adminAuth, productController.unblockProduct);

export default router;