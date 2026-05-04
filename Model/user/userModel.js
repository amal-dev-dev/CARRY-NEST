import mongoose from "mongoose";
import path from "path";
import { promiseHooks } from "v8";

const userSchema = new mongoose.Schema({

    name: {
        type : String,
        required : true,
    },
    email: {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim: true,
    },
    phone: {
        type : String,
        required : false,
    },
    password: {
        type : String,
        required : false, 
    },
    referralCode: {
        type : String,
        default : null
    },
    otp: {
        type: String
    },
    otpExpiry: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    }

});

const Users = mongoose.model('Users', userSchema);
export default Users;