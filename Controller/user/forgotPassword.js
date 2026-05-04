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

    user.resetOtp = hashedOtp;
    user.resetOtpExpiry = Date.now() + 5 * 60 * 1000;
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

    res.redirect("/user/forgot-otp");

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


    if (!email) {
      return res.redirect("/user/forgot-password");
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.render("user/forgot-otp", { message: "User not found" });
    }

    if (!user.resetOtp) {
      return res.render("user/forgot-otp", { message: "OTP not found" });
    }

    if (user.resetOtpExpiry < Date.now()) {
      return res.render("user/forgot-otp", { message: "OTP expired" });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);

    if (!isMatch) {
      return res.render("user/forgot-otp", { message: "Invalid OTP" });
    }

    user.isOtpVerified = true;
    await user.save();

    req.session.isOtpVerified = true;

    res.redirect("/user/reset-password");

  } catch (err) {
    console.log("❌ VERIFY ERROR:", err);
    res.render("user/forgot-otp", { message: "Error verifying OTP" });
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
    console.log("❌ RESET ERROR:", err);
    res.render("user/reset-password", {
      message: "Reset failed"
    });
  }
};

const loadForgotPassword = (req, res) => {
  res.render("user/forgot-password");
};

const loadVerifyOTP = (req, res) => {
  if (!req.session.email) {
    return res.redirect("/user/forgot-password");
  }

  res.render("user/forgot-otp");
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
