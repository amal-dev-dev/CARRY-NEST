import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import Users from "../../Model/user/userModel.js";
import { generateOTP } from "../../Service/otpService.js";
import dotenv from "dotenv";

dotenv.config();

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

    user.otp = hashedOtp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;
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
      subject: "OTP",
      text: `Your OTP is ${otp}`
    });

    req.session.email = email;

    res.redirect("/user/verify-otp");

  } catch (err) {
    console.log("❌ ERROR:", err);
    res.render("user/forgot-password", {
      message: "Something went wrong"
    });
  }
};

const verifyOTP = async (req, res) => {
  try {

    const { otp } = req.body;

    const email = req.session.email;

    const user = await Users.findOne({ email });

    if (!user) {
      return res.render("user/verify-otp", { message: "User not found" });
    }

    if (!user.otp) {
      return res.render("user/verify-otp", { message: "No OTP found" });
    }

    if (user.otpExpiry < Date.now()) {
      return res.render("user/verify-otp", { message: "OTP expired" });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);

    if (!isMatch) {
      return res.render("user/verify-otp", { message: "Invalid OTP" });
    }


    user.isOtpVerified = true;
    await user.save();

    res.redirect("/user/reset-password");

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.render("user/verify-otp", { message: "Error verifying OTP" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const email = req.session.email;

    const user = await Users.findOne({ email });

    if (!user || !user.isOtpVerified) {
      return res.render("user/reset-password", {
        message: "OTP not verified"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;
    user.isOtpVerified = false;

    await user.save();

    // clear session (optional but good)
    req.session.email = null;

    res.redirect("/user/login");

  } catch (err) {
    console.error(err);
    res.render("user/reset-password", {
      message: "Reset failed"
    });
  }
};

const loadForgotPassword = (req, res) => {
  res.render("user/forgot-password");
};

const loadVerifyOTP = (req, res) => {
  res.render("user/verify-otp");
};

const loadResetPassword = (req, res) => {
  res.render("user/reset-password");
};


export default {
    forgotPassword,
    verifyOTP,
    resetPassword,
    loadForgotPassword,
    loadVerifyOTP,
    loadResetPassword   
};  
