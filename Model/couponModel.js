import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
    {

        discountName: {
            type: String,
            required: true,
            trim: true
        },

        maxDiscountAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        discountCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        discountType: {
            type: String,
            enum: ["percentage", "fixed"],
            required: true
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        minOrderDiscountAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        applyTo: {
            type: String,
            enum: ["cart_total", "each-product"],
            required: true
        },

        usageLimit: {
            type: Number,
            default: null,
            min: 1
        },

        usedCount: {
            type: Number,
            default: 0,
            min: 0
        },

        userUsageLimit: {
            type: Number,
            default: 1,
            min: 1
        },

        validFrom: {
            type: Date,
            required: true
        },

        validTo: {
            type: Date,
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;