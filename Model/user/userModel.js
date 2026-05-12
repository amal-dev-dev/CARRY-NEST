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
        default: null
    },

    // ✅ SIGNUP OTP
    signupOtp: {
        type: String,
        default: null
    },
    signupOtpExpiry: {
        type: Date,
        default: null
    },

    // ✅ FORGOT PASSWORD OTP
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

});

const Users = mongoose.model('Users', userSchema);
export default Users;