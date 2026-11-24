
import crypto from "crypto";
import bcrypt from "bcrypt";

import Users from "../../Model/userModel.js";
import Referral from "../../Model/referralModel.js";

import emailService from "./emailService.js";
import { generateOTP, otpExpiryTime } from "./otpService.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Generate referral code.
const generateReferralCode = (name) => {
    const namePart = name
        .replace(/\s+/g, "")
        .substring(0, 4)
        .toUpperCase();

    const randomPart = crypto
        .randomBytes(4)
        .toString("hex")
        .substring(0, 5)
        .toUpperCase();

    return `${namePart}${randomPart}`;
};

// Generate unique referral code.
const createUniqueReferralCode = async (name) => {
    let referralCode;

    do {
        referralCode = generateReferralCode(name);

        const existingUser = await Users.findOne({
            referralCode
        });

        if (!existingUser) {
            return referralCode;
        }
    } while (true);
};


// ==============================
// USER LOGIN
// ==============================

const loginUser = async (emailOrPhone, password) => {
    if (!emailOrPhone || !password) {
        throw createError("Please enter your email/phone and password");
    }

    let user;

    if (emailOrPhone.includes("@")) {
        const email = emailOrPhone.toLowerCase();

        if (!emailRegex.test(email)) {
            throw createError("Please enter a valid email address");
        }

        user = await Users.findOne({ email });
    } else {
        if (!/^[6-9]\d{9}$/.test(emailOrPhone)) {
            throw createError(
                "Enter a valid 10-digit Indian mobile number"
            );
        }

        user = await Users.findOne({
            phone: emailOrPhone
        });
    }

    if (!user) {
        throw createError(
            "User not found. Please check your email or phone.",
            404
        );
    }

    if (user.isBlocked) {
        throw createError(
            "Your account has been blocked by admin",
            403
        );
    }

    if (!user.isVerified) {
        throw createError(
            "Please verify your account before logging in",
            403
        );
    }

    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!isMatch) {
        throw createError("Incorrect password");
    }

    return user;
};


// ==============================
// USER SIGNUP
// ==============================

const registerUser = async ({
    name,
    email,
    password,
    phone,
    referralCode
}) => {
    name = name?.trim();
    email = email?.trim().toLowerCase();
    phone = phone?.trim();
    referralCode = referralCode?.trim().toUpperCase() || "";

    if (!name || !email || !password || !phone) {
        throw createError(
            "All fields except referral code are required"
        );
    }

    if (name.length < 2 || name.length > 50) {
        throw createError(
            "Name must be between 2 and 50 characters"
        );
    }

    if (!/^[A-Za-z ]+$/.test(name)) {
        throw createError(
            "Name can contain only letters and spaces"
        );
    }

    if (!emailRegex.test(email)) {
        throw createError("Please enter a valid email address");
    }

    if (!passwordRegex.test(password)) {
        throw createError(
            "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character"
        );
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
        throw createError(
            "Enter a valid 10-digit Indian mobile number"
        );
    }

    const existingUser = await Users.findOne({ email });

    if (existingUser) {
        throw createError("Email already registered");
    }

    const existingPhone = await Users.findOne({ phone });

    if (existingPhone) {
        throw createError("Phone number already registered");
    }

    let referredBy = null;

    if (referralCode) {
        const referringUser = await Users.findOne({
            referralCode
        });

        if (!referringUser) {
            throw createError("Invalid referral code");
        }

        referredBy = referringUser._id;
    }

    const newReferralCode = await createUniqueReferralCode(name);

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = generateOTP();

    const user = new Users({
        name,
        email,
        password: hashedPassword,
        phone,
        referralCode: newReferralCode,
        referredBy,
        referralRewardReceived: false,
        signupOtp: String(otp),
        signupOtpExpiry: otpExpiryTime(),
        isVerified: false
    });

    await user.save();

    await emailService.sendOTPEmail(
        user.email,
        otp,
        "Signup Verification OTP"
    );

    return user;
};


// ==============================
// VERIFY SIGNUP OTP
// ==============================

const verifySignupOTP = async (email, enteredOtp) => {
    if (!email) {
        throw createError("Signup session expired. Please signup again.");
    }

    if (!/^\d{6}$/.test(enteredOtp)) {
        throw createError("Please enter a valid 6-digit OTP");
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    if (user.isVerified) {
        throw createError("Your account is already verified");
    }

    if (!user.signupOtp) {
        throw createError("OTP not found. Please request a new OTP.");
    }

    if (
        !user.signupOtpExpiry ||
        user.signupOtpExpiry.getTime() < Date.now()
    ) {
        throw createError("OTP expired");
    }

    if (String(user.signupOtp).trim() !== enteredOtp) {
        throw createError("Invalid OTP");
    }

    user.isVerified = true;
    user.signupOtp = null;
    user.signupOtpExpiry = null;

    await user.save();

    // Create referral after successful verification.
    if (user.referredBy) {
        const existingReferral = await Referral.findOne({
            referredUser: user._id
        });

        if (!existingReferral) {
            const referringUser = await Users.findById(
                user.referredBy
            );

            if (referringUser) {
                await Referral.create({
                    referrer: user.referredBy,
                    referredUser: user._id,
                    referralCode: referringUser.referralCode,
                    status: "pending",
                    reward: 100,
                    rewardStatus: "pending"
                });
            }
        }
    }

    return user;
};


// ==============================
// RESEND SIGNUP OTP
// ==============================

const resendSignupOTP = async (email) => {
    if (!email) {
        throw createError("Signup session expired");
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    if (user.isVerified) {
        throw createError("Your account is already verified");
    }

    const otp = generateOTP();

    user.signupOtp = String(otp);
    user.signupOtpExpiry = otpExpiryTime();

    await user.save();

    await emailService.sendOTPEmail(
        user.email,
        otp,
        "Resend Signup Verification OTP"
    );

    return true;
};


// ==============================
// FORGOT PASSWORD
// ==============================

const requestPasswordReset = async (email) => {
    email = email?.trim().toLowerCase();

    if (!email || !emailRegex.test(email)) {
        throw createError("Please enter a valid email address");
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    const otp = generateOTP();

    const hashedOtp = await bcrypt.hash(String(otp), 10);

    user.resetOtp = hashedOtp;
    user.resetOtpExpiry = otpExpiryTime();

    await user.save();

    await emailService.sendOTPEmail(
        user.email,
        otp,
        "Password Reset OTP"
    );

    return email;
};


// ==============================
// VERIFY FORGOT PASSWORD OTP
// ==============================

const verifyPasswordResetOTP = async (email, enteredOtp) => {
    if (!email) {
        throw createError("Password reset session expired");
    }

    if (!/^\d{6}$/.test(enteredOtp)) {
        throw createError("Please enter a valid 6-digit OTP");
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    if (!user.resetOtp) {
        throw createError("OTP not found. Please request a new OTP.");
    }

    if (
        !user.resetOtpExpiry ||
        user.resetOtpExpiry.getTime() < Date.now()
    ) {
        throw createError("OTP expired");
    }

    const isMatch = await bcrypt.compare(
        enteredOtp,
        user.resetOtp
    );

    if (!isMatch) {
        throw createError("Invalid OTP");
    }

    user.isOtpVerified = true;

    await user.save();

    return true;
};


// ==============================
// RESEND FORGOT PASSWORD OTP
// ==============================

const resendPasswordResetOTP = async (email) => {
    if (!email) {
        throw createError("Password reset session expired");
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    const otp = generateOTP();

    const hashedOtp = await bcrypt.hash(String(otp), 10);

    user.resetOtp = hashedOtp;
    user.resetOtpExpiry = otpExpiryTime();
    user.isOtpVerified = false;

    await user.save();

    await emailService.sendOTPEmail(
        user.email,
        otp,
        "Resend Password Reset OTP"
    );

    return true;
};


// ==============================
// RESET PASSWORD
// ==============================

const resetUserPassword = async (email, newPassword) => {
    if (!email) {
        throw createError("Password reset session expired");
    }

    if (!newPassword || !passwordRegex.test(newPassword)) {
        throw createError(
            "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character"
        );
    }

    const user = await Users.findOne({ email });

    if (!user) {
        throw createError("User not found", 404);
    }

    if (!user.isOtpVerified) {
        throw createError("OTP not verified", 403);
    }

    const hashedPassword = await bcrypt.hash(
        newPassword,
        10
    );

    user.password = hashedPassword;
    user.isOtpVerified = false;
    user.resetOtp = null;
    user.resetOtpExpiry = null;

    await user.save();

    return true;
};


const getSignupOtpExpiry = async (email) => {
    const user = await Users.findOne({ email }).select("signupOtpExpiry");

    if (!user) {
        throw createError("User not found", 404);
    }

    return user.signupOtpExpiry;
};

const getPasswordResetOtpExpiry = async (email) => {
    const user = await Users.findOne({ email }).select("resetOtpExpiry");

    if (!user) {
        throw createError("User not found", 404);
    }

    return user.resetOtpExpiry;
};


export default {
    loginUser,
    registerUser,
    verifySignupOTP,
    resendSignupOTP,
    requestPasswordReset,
    verifyPasswordResetOTP,
    resendPasswordResetOTP,
    resetUserPassword,
    getSignupOtpExpiry,
    getPasswordResetOtpExpiry
};
