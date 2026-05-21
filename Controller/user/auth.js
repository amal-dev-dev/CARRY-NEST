import Users from '../../Model/user/userModel.js';
import bcrypt from 'bcrypt';
import nodemailer from "nodemailer";
import { generateOTP,otpExpiryTime } from "../../Service/otpService.js";
import dotenv from "dotenv";
import crypto from 'crypto';

dotenv.config();

const login = async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const password = req.body.password;

        const user = await Users.findOne({ email });

        if (!user) {
            return res.render('user/login', { message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
        return res.render('user/login', { message: "Incorrect password" });
        }

        if(user.isBlocked) {
        return res.render("user/login", {message:  "Your account has been blocked by admin"});
        }   

        req.session.user = user._id;

        res.redirect('/user/home');

    } catch (error) {
        res.render('user/login', { message: "Something went wrong" });
    }
};

const loadLogin = (req, res) => {
    res.render("user/login", {
        message: null
    });
};

const loadHome = (req, res) => {

    if (!req.session.user) {
        return res.redirect('/user/login');
    }

    res.render('user/home');
};

const logout = (req, res) => {

    req.session.destroy((err) => {
        if(err){
            console.log(err);
        }

        res.clearCookie("connect.sid");
        return res.redirect("/user/login");
    });
};

const loadSignup = (req, res) => {
    res.render('user/signup', {
        message: null
    });
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

const forgotPassword = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await Users.findOne({ email });

    if (!user) {

      return res.render("user/forgot-password", {
        message: "User not found"
      });
    }

    const otp = generateOTP();

    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetOtp = hashedOtp;

    user.resetOtpExpiry = otpExpiryTime();

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}`
    });

    req.session.email = email;

    res.redirect("/user/forgot-otp");

  } catch (err) {

    console.log("ERROR:", err);

    res.render("user/forgot-password", {
      message: "Something went wrong"
    });
  }
};

const forgot_verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.session.email;


    if (!email) {
      return res.redirect("/user/forgot-password");
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.render("user/forgot-otp", {
      message: "OTP not found",
      otpExpiry: user?.resetOtpExpiry
    });
    }

    if (!user.resetOtp) {
      return res.render("user/forgot-otp", { message: "OTP not found" });
    }

    if (user.resetOtpExpiry < Date.now()) {
      return res.render("user/forgot-otp", {
      message: "OTP expired",
      otpExpiry: user.resetOtpExpiry
    });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);

    if (!isMatch) {
      return res.render("user/forgot-otp", {
      message: "Invalid OTP",
      otpExpiry: user.resetOtpExpiry
    });
    }

    user.isOtpVerified = true;
    await user.save();

    req.session.isOtpVerified = true;

    res.redirect("/user/reset-password");

  } catch (err) {
    console.log("VERIFY ERROR:", err);
    res.render("user/forgot-otp", {
      message: "Error verifying OTP",
      otpExpiry: Date.now()
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const email = req.session.email;

    if (!email) {
      return res.redirect("/user/forgot-password");
    }

    const user = await Users.findOne({ email });

   if (!user || (!user.isOtpVerified && !req.session.isOtpVerified)) {
    return res.render("user/reset-password", {
        message: "OTP not verified"
    });
}

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.isOtpVerified = false;
    user.resetOtp = null;
    user.resetOtpExpiry = null;

    await user.save();

    req.session.destroy();

    res.redirect("/user/login");

  } catch (err) {
    console.log("RESET ERROR:", err);
    res.render("user/reset-password", {
      message: "Reset failed"
    });
  }
};

const forgot_resendOTP = async (req, res) => {

    try {

        const email = req.session.email;

        if (!email) {
            return res.redirect('/user/forgot-password');
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.redirect('/user/forgot-password');
        }

        const otp = generateOTP();

        const hashedOtp = await bcrypt.hash(otp, 10);

        user.resetOtp = hashedOtp;

        user.resetOtpExpiry = otpExpiryTime();

        await user.save();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            to: email,
            subject: "Resend OTP",
            text: `Your OTP is ${otp}`
        });

        res.redirect('/user/forgot-otp');

    } catch (error) {

        console.log(error);

        res.redirect('/user/forgot-password');
    }
};

const loadForgotPassword = (req, res) => {
  res.render("user/forgot-password");
};

const forgot_loadVerifyOTP = async (req, res) => {

  try {

    const email = req.session.email;

    if (!email) {
      return res.redirect("/user/forgot-password");
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.redirect("/user/forgot-password");
    }

    res.render("user/forgot-otp", {
      otpExpiry: user.resetOtpExpiry,
      message: null
    });

  } catch (error) {

    console.log(error);

    res.redirect("/user/forgot-password");
  }
};

const loadResetPassword = (req, res) => {
  res.render("user/reset-password");
};



export default {
    login,
    loadLogin,
    loadHome,
    logout,
    loadSignup,
    signup,
    sendOTP,
    verifyOTP,
    loadVerifyOTP,
    resendOTP,
    forgotPassword,
    forgot_verifyOTP,
    resetPassword,
    loadForgotPassword,
    loadResetPassword,
    forgot_resendOTP,
    forgot_loadVerifyOTP
};