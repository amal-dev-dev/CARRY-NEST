import Users from '../../Model/user/userModel.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

// ================= SIGNUP PAGE =================
const loadSignup = (req, res) => {
    res.render('user/signup');
};

// ================= SIGNUP =================
const signup = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (!cleanName || !cleanEmail || !password || !confirmPassword) {
            return res.render('user/signup', { message: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.render('user/signup', { message: "Passwords do not match" });
        }

        const existingUser = await Users.findOne({ email: cleanEmail });

        if (existingUser) {
            return res.render('user/signup', { message: "User already exists" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new Users({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password: hashedPassword,
            signupOtp: otp,
            signupOtpExpiry: Date.now() + 5 * 60 * 1000,
            isVerified: false
        });

        await newUser.save();

        req.session.userIdForOtp = newUser._id;


        await sendOTP(cleanEmail, otp);

        res.redirect('/user/signup/otp');

    } catch (error) {
        console.log("SIGNUP ERROR:", error);
        res.render('user/signup', { message: "Signup failed" });
    }
};

// ================= LOAD OTP PAGE =================
const loadVerifyOTP = (req, res) => {
    const userId = req.session.userIdForOtp;

    if (!userId) {
        return res.redirect('/user/signup');
    }

    res.render("user/signup-otp");
};

// ================= SEND OTP =================
const sendOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP Verification',
        text: `Your OTP is ${otp}`
    });
};

// ================= VERIFY OTP =================
const verifyOTP = async (req, res) => {
    try {
        const userId = req.session.userIdForOtp;
        const { otp } = req.body;

        if (!userId) {
            return res.redirect('/user/signup');
        }

        const user = await Users.findById(userId);

        if (!user) {
            return res.redirect('/user/signup');
        }

        if (!user.signupOtp) {
            return res.render('user/signup-otp', {
                message: "OTP not found. Try again"
            });
        }

        if (user.signupOtpExpiry < Date.now()) {
            return res.render('user/signup-otp', {
                message: "OTP expired"
            });
        }

        if (user.signupOtp !== otp.trim()) {
            return res.render('user/signup-otp', {
                message: "Invalid OTP"
            });
        }

        user.isVerified = true;
        user.signupOtp = null;
        user.signupOtpExpiry = null;

        await user.save();

        req.session.userIdForOtp = null;

        res.redirect('/user/login');

    } catch (error) {
        console.log("VERIFY ERROR:", error);
        res.render('user/signup-otp', {
            message: "Something went wrong"
        });
    }
};

export default {
    loadSignup,
    signup,
    loadVerifyOTP,
    verifyOTP
};