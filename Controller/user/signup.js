import Users from '../../Model/user/userModel.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const loadSignup = (req, res) => {
    res.render('user/signup');
};

const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await Users.findOne({ email });

        if (existingUser) {
            return res.render('user/signup', { message: "User already exists" });
        }

        if (!email) {
            return res.redirect('/user/signup');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = new Users({
            name,
            email,
            password: hashedPassword,
            otp,
            otpExpiry: Date.now() + 5 * 60 * 1000,
            isVerified: false
        });

        await newUser.save();

        await sendOTP(email, otp);

        req.session.tempUser = email;

        res.redirect('/user/verify-otp');

    } catch (error) {
        console.log("🔥 SIGNUP ERROR:", error);
        res.render('user/signup', { message: "Signup failed" });
}
};

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

const verifyOTP = async (req, res) => {
    try {
        const enteredOtp = req.body.otp.trim();

        const email = req.session.tempUser;

        if (!email) {
            return res.redirect('/user/signup');
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.send("User not found");
        }

        if (String(user.otp).trim() !== enteredOtp) {
            return res.render('user/verify-otp', { message: "Invalid OTP" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.render('user/verify-otp', { message: "OTP expired" });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        res.redirect('/user/login');

    } catch (error) {
        console.log(error);
        res.render('user/verify-otp', { message: "Something went wrong" });
    }
};

export default {
    loadSignup,
    signup,
    sendOTP,
    verifyOTP
};