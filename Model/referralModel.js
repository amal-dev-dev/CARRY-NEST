import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
    {
        // User who shared the referral code
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },

        // New user who joined using the referral
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },

        // Referral code that was used
        referralCode: {
            type: String,
            required: true,
            trim: true
        },

        // Referral status
        status: {
            type: String,
            enum: ["pending", "completed"],
            default: "pending"
        },

        // Reward amount
        reward: {
            type: Number,
            default: 100
        },

        // Whether reward was actually credited
        rewardStatus: {
            type: String,
            enum: ["pending", "credited"],
            default: "pending"
        },

        // When referral was created
        createdAt: {
            type: Date,
            default: Date.now
        },

        // When referral was completed
        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);


// Prevent the same user from being referred twice
referralSchema.index(
    {
        referrer: 1,
        referredUser: 1
    },
    {
        unique: true
    }
);


const Referral = mongoose.model("Referral", referralSchema);

export default Referral;