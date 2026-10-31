import Coupon from "../../Model/couponModel.js";
import Offer from "../../Model/offerModel.js";


// ==============================
// LOAD COUPON LIST
// ==============================

const loadCoupons = async (req, res) => {
    try {

        const coupons = await Coupon.find()
            .sort({ createdAt: -1 });

        const offers = await Offer.find()
            .populate("productId", "productName")
            .populate("categoryId", "name")
            .sort({ createdAt: -1 })
            .lean();

        return res.render("admin/coupons", {
            coupons,
            offers
        });

    } catch (error) {

        console.log("LOAD COUPONS ERROR:", error);

        return res.redirect("/admin/pageerror");
    }
};


// ==============================
// LOAD ADD COUPON PAGE
// ==============================

const loadAddCoupon = async (req, res) => {
    try {
        const message = req.session.message;
        delete req.session.message;

        return res.render("admin/add-coupon", {
            message
        });

    } catch (error) {
        console.log("LOAD ADD COUPON ERROR:", error);
        return res.redirect("/admin/coupons");
    }
};


// ==============================
// ADD COUPON
// ==============================

const addCoupon = async (req, res) => {
    try {

        const {
            discountName,
            discountCode,
            discountType,
            discountValue,
            maxDiscountAmount,
            description,
            minOrderDiscountAmount,
            applyTo,
            validFrom,
            validTo,
            usageLimit,
            userLimit
        } = req.body;


        // ==============================
        // BASIC VALIDATION
        // ==============================

        if (
            !discountName ||
            !discountCode ||
            !discountType ||
            !discountValue ||
            !description ||
            !validFrom ||
            !validTo ||
            !usageLimit ||
            !userLimit
        ) {
            req.session.message = "Please fill all required fields";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // CHECK DISCOUNT VALUE
        // ==============================

        if (Number(discountValue) <= 0) {

            req.session.message =
                "Discount value must be greater than 0";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // MAX DISCOUNT VALIDATION
        // ==============================

        if (
            maxDiscountAmount !== undefined &&
            maxDiscountAmount !== "" &&
            Number(maxDiscountAmount) < 0
        ) {
            req.session.message =
                "Maximum discount amount cannot be negative";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // USAGE LIMIT VALIDATION
        // ==============================

        if (Number(usageLimit) <= 0) {

            req.session.message =
                "Total usage limit must be greater than 0";

            return res.redirect("/admin/coupons/add");
        }


        if (Number(userLimit) <= 0) {

            req.session.message =
                "User usage limit must be greater than 0";

            return res.redirect("/admin/coupons/add");
        }


        if (Number(userLimit) > Number(usageLimit)) {

            req.session.message =
                "User usage limit cannot exceed total usage limit";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // MINIMUM ORDER VALIDATION
        // ==============================

        if (
            minOrderDiscountAmount !== undefined &&
            minOrderDiscountAmount !== "" &&
            Number(minOrderDiscountAmount) < 0
        ) {
            req.session.message =
                "Minimum order amount cannot be negative";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // CHECK DATES
        // ==============================

        if (new Date(validTo) <= new Date(validFrom)) {

            req.session.message =
                "Valid To date must be after Valid From date";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // PERCENTAGE VALIDATION
        // ==============================

        if (
            discountType === "percentage" &&
            Number(discountValue) > 100
        ) {

            req.session.message =
                "Percentage discount cannot exceed 100%";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // FIXED DISCOUNT VALIDATION
        // ==============================

        if (
            discountType === "fixed" &&
            Number(maxDiscountAmount) > 0
        ) {
            req.session.message =
                "Maximum discount amount is only applicable to percentage discounts";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // CHECK EXISTING COUPON
        // ==============================

        const existingCoupon = await Coupon.findOne({
            discountCode: discountCode.trim().toUpperCase()
        });

        if (existingCoupon) {

            req.session.message =
                "Coupon code already exists";

            return res.redirect("/admin/coupons/add");
        }


        // ==============================
        // CREATE COUPON
        // ==============================

        const coupon = new Coupon({

            discountName:
                discountName.trim(),

            discountCode:
                discountCode.trim().toUpperCase(),

            discountType,

            discountValue:
                Number(discountValue),

            maxDiscountAmount:
                Number(maxDiscountAmount) || 0,

            description:
                description.trim(),

            minOrderDiscountAmount:
                Number(minOrderDiscountAmount) || 0,

            applyTo,

            validFrom:
                new Date(validFrom),

            validTo:
                new Date(validTo),

            usageLimit:
                Number(usageLimit),

            usedCount: 0,

            userUsageLimit:
                Number(userLimit),

            isActive: true
        });


        await coupon.save();


        req.session.message =
            "Coupon created successfully";

        return res.redirect("/admin/coupons");


    } catch (error) {

        console.log("ADD COUPON ERROR:", error);

        req.session.message =
            "Unable to create coupon";

        return res.redirect("/admin/coupons/add");
    }
};


// ==============================
// LOAD EDIT COUPON
// ==============================

const loadEditCoupon = async (req, res) => {
    try {

        const { id } = req.params;

        const coupon = await Coupon.findById(id);

        if (!coupon) {

            req.session.message =
                "Coupon not found";

            return res.redirect("/admin/coupons");
        }


        return res.render("admin/edit-coupon", {
            coupon,
            message: req.session.message
        });

    } catch (error) {

        console.log("LOAD EDIT COUPON ERROR:", error);

        return res.redirect("/admin/coupons");
    }
};


// ==============================
// UPDATE COUPON
// ==============================

const updateCoupon = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            discountName,
            discountCode,
            discountType,
            discountValue,
            maxDiscountAmount,
            description,
            minOrderDiscountAmount,
            applyTo,
            validFrom,
            validTo,
            usageLimit,
            userUsageLimit
        } = req.body;


        // ==================================================
        // FIND COUPON
        // ==================================================

        const coupon = await Coupon.findById(id);

        if (!coupon) {

            req.session.message =
                "Coupon not found";

            return res.redirect("/admin/coupons");
        }


        // ==================================================
        // REQUIRED FIELD VALIDATION
        // ==================================================

        if (
            !discountName?.trim() ||
            !discountCode?.trim() ||
            !discountType ||
            !discountValue ||
            !description?.trim() ||
            !validFrom ||
            !validTo ||
            !usageLimit ||
            !userUsageLimit
        ) {

            req.session.message =
                "Please fill all required fields";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // CONVERT VALUES TO NUMBERS
        // ==================================================

        const discount = Number(discountValue);
        const maxDiscount = Number(maxDiscountAmount || 0);
        const minimumOrder = Number(minOrderDiscountAmount || 0);
        const totalUsage = Number(usageLimit);
        const userUsage = Number(userUsageLimit);


        // ==================================================
        // NUMERIC VALIDATION
        // ==================================================

        if (!Number.isFinite(discount) || discount <= 0) {

            req.session.message =
                "Discount value must be a valid positive number";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        if (!Number.isFinite(totalUsage) || totalUsage <= 0) {

            req.session.message =
                "Total usage limit must be a valid positive number";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        if (!Number.isFinite(userUsage) || userUsage <= 0) {

            req.session.message =
                "User usage limit must be a valid positive number";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        if (!Number.isFinite(maxDiscount) || maxDiscount < 0) {

            req.session.message =
                "Maximum discount amount cannot be negative";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        if (!Number.isFinite(minimumOrder) || minimumOrder < 0) {

            req.session.message =
                "Minimum order amount cannot be negative";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // USER LIMIT VS TOTAL LIMIT
        // ==================================================

        if (userUsage > totalUsage) {

            req.session.message =
                "User usage limit cannot exceed total usage limit";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // DISCOUNT TYPE VALIDATION
        // ==================================================

        if (!["percentage", "fixed"].includes(discountType)) {

            req.session.message =
                "Invalid discount type";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // PERCENTAGE VALIDATION
        // ==================================================

        if (
            discountType === "percentage" &&
            discount > 100
        ) {

            req.session.message =
                "Percentage discount cannot exceed 100%";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // FIXED DISCOUNT VALIDATION
        // ==================================================

        if (
            discountType === "fixed" &&
            maxDiscount > 0
        ) {

            req.session.message =
                "Maximum discount amount is only applicable to percentage discounts";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // DATE VALIDATION
        // ==================================================

        const startDate = new Date(validFrom);
        const endDate = new Date(validTo);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {

            req.session.message =
                "Invalid coupon dates";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        if (endDate <= startDate) {

            req.session.message =
                "Valid To date must be after Valid From date";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // NORMALIZE CODE
        // ==================================================

        const normalizedCode =
            discountCode.trim().toUpperCase();


        // ==================================================
        // CHECK DUPLICATE CODE
        // ==================================================

        const existingCoupon = await Coupon.findOne({
            discountCode: normalizedCode,
            _id: { $ne: id }
        });

        if (existingCoupon) {

            req.session.message =
                "Coupon code already exists";

            return res.redirect(`/admin/coupons/edit/${id}`);
        }


        // ==================================================
        // UPDATE COUPON
        // ==================================================

        coupon.discountName =
            discountName.trim();

        coupon.discountCode =
            normalizedCode;

        coupon.discountType =
            discountType;

        coupon.discountValue =
            discount;

        coupon.maxDiscountAmount =
            discountType === "percentage"
                ? maxDiscount
                : 0;

        coupon.description =
            description.trim();

        coupon.minOrderDiscountAmount =
            minimumOrder;

        coupon.applyTo =
            applyTo;

        coupon.validFrom =
            startDate;

        coupon.validTo =
            endDate;

        coupon.usageLimit =
            totalUsage;

        coupon.userUsageLimit =
            userUsage;


        await coupon.save();


        req.session.message =
            "Coupon updated successfully";

        return res.redirect("/admin/coupons");


    } catch (error) {

        console.log("UPDATE COUPON ERROR:", error);

        req.session.message =
            "Unable to update coupon";

        return res.redirect(
            `/admin/coupons/edit/${req.params.id}`
        );
    }
};

// ==============================
// TOGGLE COUPON STATUS
// ==============================

const toggleCouponStatus = async (req, res) => {
    try {

        const { id } = req.params;

        const coupon = await Coupon.findById(id);

        if (!coupon) {

            req.session.message =
                "Coupon not found";

            return res.redirect("/admin/coupons");
        }


        coupon.isActive =
            !coupon.isActive;

        await coupon.save();


        req.session.message =
            coupon.isActive
                ? "Coupon activated successfully"
                : "Coupon deactivated successfully";


        return res.redirect("/admin/coupons");


    } catch (error) {

        console.log(
            "TOGGLE COUPON STATUS ERROR:",
            error
        );

        req.session.message =
            "Unable to update coupon status";

        return res.redirect("/admin/coupons");
    }
};


// ==============================
// DELETE COUPON
// ==============================

const deleteCoupon = async (req, res) => {
    try {

        const { id } = req.params;

        const coupon =
            await Coupon.findByIdAndDelete(id);

        if (!coupon) {

            req.session.message =
                "Coupon not found";

            return res.redirect("/admin/coupons");
        }


        req.session.message =
            "Coupon deleted successfully";

        return res.redirect("/admin/coupons");


    } catch (error) {

        console.log(
            "DELETE COUPON ERROR:",
            error
        );

        req.session.message =
            "Unable to delete coupon";

        return res.redirect("/admin/coupons");
    }
};


export default {
    loadCoupons,
    loadAddCoupon,
    addCoupon,
    loadEditCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
};