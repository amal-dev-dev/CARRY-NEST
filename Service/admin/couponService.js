
import Coupon from "../../Model/couponModel.js";
import Offer from "../../Model/offerModel.js";

const ITEMS_PER_PAGE = 5;

// GET COUPONS AND OFFERS PAGE DATA
const getCouponsPageData = async (couponPage = 1, offerPage = 1) => {
    const [totalCoupons, totalOffers] = await Promise.all([
        Coupon.countDocuments(),
        Offer.countDocuments()
    ]);

    const couponTotalPages = Math.max(
        1,
        Math.ceil(totalCoupons / ITEMS_PER_PAGE)
    );

    const offerTotalPages = Math.max(
        1,
        Math.ceil(totalOffers / ITEMS_PER_PAGE)
    );

    const currentCouponPage = Math.min(
        Math.max(1, Number.parseInt(couponPage, 10) || 1),
        couponTotalPages
    );

    const currentOfferPage = Math.min(
        Math.max(1, Number.parseInt(offerPage, 10) || 1),
        offerTotalPages
    );

    const [coupons, offers] = await Promise.all([
        Coupon.find()
            .sort({ createdAt: -1 })
            .skip((currentCouponPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .lean(),

        Offer.find()
            .populate("productId", "productName")
            .populate("categoryId", "name")
            .sort({ createdAt: -1 })
            .skip((currentOfferPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .lean()
    ]);

    return {
        coupons,
        offers,
        couponPage: currentCouponPage,
        couponTotalPages,
        totalCoupons,
        offerPage: currentOfferPage,
        offerTotalPages,
        totalOffers
    };
};


// GET COUPON BY ID
const getCouponById = async (id) => {
    return await Coupon.findById(id);
};


// VALIDATE COUPON DATA
const validateCouponData = (data, isUpdate = false) => {
    const {
        discountName,
        discountCode,
        discountType,
        discountValue,
        maxDiscountAmount,
        description,
        minOrderDiscountAmount,
        validFrom,
        validTo,
        usageLimit
    } = data;

    // Support both field names
    const userLimit = data.userUsageLimit ?? data.userLimit;

    if (
        !discountName?.trim() ||
        !discountCode?.trim() ||
        !discountType ||
        !discountValue ||
        !description?.trim() ||
        !validFrom ||
        !validTo ||
        !usageLimit ||
        !userLimit
    ) {
        return {
            success: false,
            message: "Please fill all required fields"
        };
    }

    const discount = Number(discountValue);
    const maxDiscount = Number(maxDiscountAmount || 0);
    const minimumOrder = Number(minOrderDiscountAmount || 0);
    const totalUsage = Number(usageLimit);
    const userUsage = Number(userLimit);

    if (!Number.isFinite(discount) || discount <= 0) {
        return {
            success: false,
            message: "Discount value must be a valid positive number"
        };
    }

    if (!["percentage", "fixed"].includes(discountType)) {
        return {
            success: false,
            message: "Invalid discount type"
        };
    }

    if (
        !Number.isFinite(maxDiscount) ||
        maxDiscount < 0
    ) {
        return {
            success: false,
            message: "Maximum discount amount cannot be negative"
        };
    }

    if (
        !Number.isFinite(minimumOrder) ||
        minimumOrder < 0
    ) {
        return {
            success: false,
            message: "Minimum order amount cannot be negative"
        };
    }

    if (!Number.isFinite(totalUsage) || totalUsage <= 0) {
        return {
            success: false,
            message: "Total usage limit must be greater than 0"
        };
    }

    if (!Number.isFinite(userUsage) || userUsage <= 0) {
        return {
            success: false,
            message: "User usage limit must be greater than 0"
        };
    }

    if (userUsage > totalUsage) {
        return {
            success: false,
            message: "User usage limit cannot exceed total usage limit"
        };
    }

    if (
        discountType === "percentage" &&
        discount > 100
    ) {
        return {
            success: false,
            message: "Percentage discount cannot exceed 100%"
        };
    }

    if (
        discountType === "fixed" &&
        maxDiscount > 0
    ) {
        return {
            success: false,
            message: "Maximum discount amount is only applicable to percentage discounts"
        };
    }

    const startDate = new Date(validFrom);
    const endDate = new Date(validTo);

    if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
    ) {
        return {
            success: false,
            message: "Invalid coupon dates"
        };
    }

    if (endDate <= startDate) {
        return {
            success: false,
            message: "Valid To date must be after Valid From date"
        };
    }

    // Preserve the original add-coupon validation rule.
    if (
        !isUpdate &&
        minimumOrder < discount
    ) {
        return {
            success: false,
            message: "Minimum order amount cannot be less than discount value"
        };
    }

    return {
        success: true,
        data: {
            discountName: discountName.trim(),
            discountCode: discountCode.trim().toUpperCase(),
            discountType,
            discountValue: discount,
            maxDiscountAmount:
                discountType === "percentage" ? maxDiscount : 0,
            description: description.trim(),
            minOrderDiscountAmount: minimumOrder,
            applyTo: data.applyTo,
            validFrom: startDate,
            validTo: endDate,
            usageLimit: totalUsage,
            userUsageLimit: userUsage
        }
    };
};


// ADD COUPON
const addCoupon = async (data) => {
    const validation = validateCouponData(data);

    if (!validation.success) {
        return validation;
    }

    const existingCoupon = await Coupon.findOne({
        discountCode: validation.data.discountCode
    });

    if (existingCoupon) {
        return {
            success: false,
            message: "Coupon code already exists"
        };
    }

    const coupon = new Coupon({
        ...validation.data,
        usedCount: 0,
        isActive: true
    });

    await coupon.save();

    return {
        success: true,
        coupon
    };
};


// UPDATE COUPON
const updateCoupon = async (id, data) => {
    const coupon = await Coupon.findById(id);

    if (!coupon) {
        return {
            success: false,
            notFound: true,
            message: "Coupon not found"
        };
    }

    const validation = validateCouponData(data, true);

    if (!validation.success) {
        return validation;
    }

    const existingCoupon = await Coupon.findOne({
        discountCode: validation.data.discountCode,
        _id: { $ne: id }
    });

    if (existingCoupon) {
        return {
            success: false,
            message: "Coupon code already exists"
        };
    }

    Object.assign(coupon, validation.data);

    await coupon.save();

    return {
        success: true,
        coupon
    };
};


// TOGGLE COUPON STATUS
const toggleCouponStatus = async (id) => {
    const coupon = await Coupon.findById(id);

    if (!coupon) {
        return {
            success: false,
            notFound: true,
            message: "Coupon not found"
        };
    }

    const newStatus = !coupon.isActive;

    const updatedCoupon = await Coupon.findByIdAndUpdate(
        id,
        {
            $set: {
                isActive: newStatus
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedCoupon) {
        return {
            success: false,
            message: "Unable to update coupon status"
        };
    }

    return {
        success: true,
        isActive: newStatus,
        coupon: updatedCoupon
    };
};


// DELETE COUPON
const deleteCoupon = async (id) => {
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
        return {
            success: false,
            notFound: true,
            message: "Coupon not found"
        };
    }

    return {
        success: true,
        coupon
    };
};


export default {
    getCouponsPageData,
    getCouponById,
    addCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
};
