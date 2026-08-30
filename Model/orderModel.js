import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },

    products: [
        {
            variantId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },

            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },

            quantity: {
                type: Number,
                required: true
            },

            price: {
                type: Number,
                required: true
            },

            status: {
                type: String,
            enum: [
                    "pending",
                    "shipped",
                    "out_for_delivery",
                    "delivered",
                    "cancelled",
                    "partially_cancelled",
                    "returned",
                    "return_requested",
                    "partially_returned"
                ],
                default: "pending"
            },

            cancelReason: {
                type: String,
                default: ""
            },

            cancelledAt: {
                type: Date,
                default: null
            },

            returnReason: {
            type: String,
            default: ""
            },

            returnedAt: {
                type: Date,
                default: null
            },

            returnStatus: {
                type: String,
                enum: ["none", "requested", "approved", "rejected", "returned"],
                default: "none"
            }
        }
    ],

    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        default: null
    },

    discountApplied: {
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    paymentMethod: {
        type: String,
        enum: ["COD", "RAZORPAY", "WALLET"],
        default: "COD"
    },

    paymentStatus: {
        type: String,
        enum: ["completed", "failed", "pending"],
        default: "pending"
    },

    orderStatus: {
        type: String,
        enum: [
            "pending",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "partially_cancelled"
        ],
        default: "pending"
    },

    deliveryDate: {
        type: Date
    },

    deliveryAddress: {
        name: String,
        phone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        pincode: String
    }

}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

export default Order;