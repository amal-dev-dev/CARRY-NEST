
import couponService from "../../Service/admin/couponService.js";

// LOAD COUPON LIST
const loadCoupons = async (req, res) => {
    try {
        const {
            couponPage = 1,
            offerPage = 1
        } = req.query;

        const data = await couponService.getCouponsPageData(
            couponPage,
            offerPage
        );

        return res.render("admin/coupons", data);

    } catch (error) {
        console.error("LOAD COUPONS ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};


// LOAD ADD COUPON PAGE
const loadAddCoupon = (req, res) => {
    try {
        const message = req.session.message || null;

        delete req.session.message;

        res.render("admin/add-coupon", {
            message
        });

    } catch (error) {
        console.error("Load Add Coupon Error:", error);
        res.redirect("/admin/coupons");
    }
};


// ADD COUPON
const addCoupon = async (req, res) => {
    try {
        const result = await couponService.addCoupon(req.body);

        if (!result.success) {
            req.session.message = result.message;
            return res.redirect("/admin/coupons/add");
        }

        req.session.message = "Coupon created successfully!";
        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Add Coupon Controller Error:", error);

        req.session.message = "Unable to create coupon. Please try again.";
        return res.redirect("/admin/coupons/add");
    }
};


// LOAD EDIT COUPON
const loadEditCoupon = async (req, res) => {
    try {
        const coupon = await couponService.getCouponById(req.params.id);

        if (!coupon) {
            return res.redirect("/admin/coupons");
        }

        const message = req.session.message || null;
        delete req.session.message;

        res.render("admin/edit-coupon", {
            coupon,
            message
        });

    } catch (error) {
        console.error("Load Edit Coupon Error:", error);
        res.redirect("/admin/coupons");
    }
};


// UPDATE COUPON
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await couponService.updateCoupon(
            id,
            req.body
        );

        if (!result.success) {
            req.session.message = result.message;

            if (result.notFound) {
                return res.redirect("/admin/coupons");
            }

            return res.redirect(`/admin/coupons/edit/${id}`);
        }

        req.session.message = "Coupon updated successfully";

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("UPDATE COUPON ERROR:", error);

        req.session.message = "Unable to update coupon";

        return res.redirect(`/admin/coupons/edit/${req.params.id}`);
    }
};


// TOGGLE COUPON STATUS
const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await couponService.toggleCouponStatus(id);

        if (!result.success) {
            req.session.message = result.message;
            return res.redirect("/admin/coupons");
        }

        req.session.message = result.isActive
            ? "Coupon activated successfully"
            : "Coupon deactivated successfully";

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("TOGGLE COUPON STATUS ERROR:", error);

        req.session.message = "Unable to update coupon status";

        return res.redirect("/admin/coupons");
    }
};


// DELETE COUPON
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await couponService.deleteCoupon(id);

        if (!result.success) {
            req.session.message = result.message;
            return res.redirect("/admin/coupons");
        }

        req.session.message = "Coupon deleted successfully";

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("DELETE COUPON ERROR:", error);

        req.session.message = "Unable to delete coupon";

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
