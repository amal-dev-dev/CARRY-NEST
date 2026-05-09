import Users from '../../Model/user/userModel.js';
import { generateOTP, otpExpiryTime } from '../../Service/otpService.js';
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
            return res.render('user/signup', {
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const otp = generateOTP();

        const user = new Users({
            name,
            email,
            password: hashedPassword,
            signupOtp: String(otp),
            signupOtpExpiry: otpExpiryTime(),
            isVerified: false
        });

        await user.save();

        await sendOTP(user.email, otp);

        req.session.tempUser = email;

        res.redirect('/user/signup-otp');

    } catch (error) {

        console.log("SIGNUP ERROR:", error);

        res.render('user/signup', {
            message: "Signup failed"
        });
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

        if (String(user.signupOtp).trim() !== enteredOtp) {
        return res.render('user/signup-otp', {
            message: "Invalid OTP",
            otpExpiry: user.signupOtpExpiry
        });
        }

        if (user.signupOtpExpiry < Date.now()) {
        return res.render('user/signup-otp', {
            message: "OTP expired",
            otpExpiry: user.signupOtpExpiry
        });
        }

        user.isVerified = true;
        user.signupOtp = null;
        user.signupOtpExpiry = null;

        await user.save();

        res.redirect('/user/login');

    } catch (error) {
        console.log(error);
        res.render('user/signup-otp', {
        message: "Something went wrong",
        otpExpiry: user?.signupOtpExpiry || Date.now()
        });
    }
};

const loadVerifyOTP = async (req, res) => {

    try {

        const email = req.session.tempUser;

        if (!email) {
            return res.redirect('/user/signup');
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.redirect('/user/signup');
        }

        res.render('user/signup-otp', {
            message: null,
            otpExpiry: user.signupOtpExpiry
        });

    } catch (error) {

        console.log(error);

        res.redirect('/user/signup');
    }
};

const resendOTP = async (req, res) => {

    try {

        const email = req.session.tempUser;

        if (!email) {
            return res.redirect('/user/signup');
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.redirect('/user/signup');
        }

        const otp = generateOTP();

        user.signupOtp = String(otp);

        user.signupOtpExpiry = otpExpiryTime();

        await user.save();

        await sendOTP(email, otp);

        res.redirect('/user/signup-otp');

    } catch (error) {

        console.log(error);

        res.redirect('/user/signup');
    }
};


export default {
    loadSignup,
    signup,
    sendOTP,
    verifyOTP,
    loadVerifyOTP,
    resendOTP
};