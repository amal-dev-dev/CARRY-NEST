import express from "express";
import adminController from "../../Controller/admin/authController.js";
import { adminAuth, adminLoggedIn }  from "../../Middleware/adminAuth.js";

const router = express.Router();

router.get("/login", adminLoggedIn, adminController.loadLogin);
router.post("/login", adminController.login);

router.get("/dashboard", adminAuth, adminController.loadDashboard);

router.get("/customers", adminAuth, adminController.loadCustomers);

router.get("/block-user/:id", adminAuth, adminController.blockUser);
router.get("/unblock-user/:id", adminAuth, adminController.unblockUser);

router.get("/logout", adminAuth, adminController.logout);

export default router;