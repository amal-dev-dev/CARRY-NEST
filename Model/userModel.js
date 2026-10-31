import mongoose from "mongoose";
import path from "path";
import { promiseHooks } from "v8";

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },

    phone: {
        type: String,
    },

    password: {
        type: String,
    },

    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        default: null
    },

    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        default: null
    },

    referralRewardReceived: {
        type: Boolean,
        default: false
    },

    signupOtp: {
        type: String,
        default: null
    },

    signupOtpExpiry: {
        type: Date,
        default: null
    },

    resetOtp: {
        type: String,
        default: null
    },

    resetOtpExpiry: {
        type: Date,
        default: null
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    profileImage: {
        type: String,
        default: ""
    },
    
    isBlocked: {
     type: Boolean,
     default: false
 },

}, { timestamps: true });

const Users = mongoose.model('Users', userSchema);
export default Users;
