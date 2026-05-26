import express from "express";
import adminController from "../../Controller/admin/authController.js";
import categoryController from "../../Controller/admin/categoryController.js"
import { adminAuth, adminLoggedIn }  from "../../Middleware/adminAuth.js";

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
router.post("/edit-category/:id", adminAuth, categoryController.editCategory);
router.get("/unlist-category/:id", adminAuth, categoryController.unlistCategory);
router.get("/list-category/:id", adminAuth, categoryController.listCategory);

export default router;