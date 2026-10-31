import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
            unique: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        transactions: [
            {
                type: {
                    type: String,
                    enum: ["credit", "debit"],
                    required: true
                },

                amount: {
                    type: Number,
                    required: true
                },

                description: {
                    type: String,
                    required: true
                },

                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    default: null
                },

                razorpayOrderId: {
                    type: String,
                    default: null
                },

                razorpayPaymentId: {
                    type: String,
                    default: null
                },

                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;