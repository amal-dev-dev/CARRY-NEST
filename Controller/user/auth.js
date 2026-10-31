import Users from '../../Model/userModel.js';
import bcrypt from 'bcrypt';
import nodemailer from "nodemailer";
import { generateOTP,otpExpiryTime } from "../../Service/otpService.js";
import Product from "../../Model/productModel.js";
import Offer from "../../Model/offerModel.js";
import Referral from "../../Model/referralModel.js";
import Order from "../../Model/orderModel.js";
import Review from "../../Model/reviewModel.js";
import dotenv from "dotenv";

dotenv.config();

const generateReferralCode = (name) => {
    const namePart =
        name
            .replace(/\s+/g, "")
            .substring(0, 4)
            .toUpperCase();

    const randomPart =
        Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();

    return `${namePart}${randomPart}`;
};


const login = async (req, res) => {
    try {
        const emailOrPhone = req.body.email?.trim();
        const password = req.body.password;

        // 1. Validate required fields
        if (!emailOrPhone || !password) {
            return res.status(400).render("user/login", {
                message: "Please enter your email/phone and password"
            });
        }

        // 2. Determine whether input is email or phone
        let user;

        if (emailOrPhone.includes("@")) {
            const email = emailOrPhone.toLowerCase();

            // Validate email format
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).render("user/login", {
                    message: "Please enter a valid email address"
                });
            }

            user = await Users.findOne({ email });

        } else {
            // Validate Indian mobile number
            if (!/^[6-9]\d{9}$/.test(emailOrPhone)) {
                return res.status(400).render("user/login", {
                    message: "Enter a valid 10-digit Indian mobile number"
                });
            }

            user = await Users.findOne({ phone: emailOrPhone });
        }

        // 3. Check whether user exists
        if (!user) {
            return res.status(400).render("user/login", {
                message: "User not found. Please check your email or phone."
            });
        }

        // 4. Check whether account is blocked
        if (user.isBlocked) {
            return res.status(403).render("user/login", {
                message: "Your account has been blocked by admin"
            });
        }

        // 5. Verify password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).render("user/login", {
                message: "Incorrect password"
            });
        }

        // 6. Create session
        req.session.user = user._id;

        // 7. Redirect to home
        return res.redirect("/user/home");

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        return res.status(500).render("user/login", {
            message: "Something went wrong. Please try again."
        });
    }
};


const loadLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/user/home');
    }

    const message = req.session.message;
    req.session.message = null;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.render('user/login', {
        message: message || ''
    });
};

const loadHome = async (req, res) => {
    try {
        const now = new Date();

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        // Fetch normal homepage products, active offers,
        // and actual product sales.
        const [products, activeOffers, salesData] = await Promise.all([
            Product.find({ isBlocked: false })
                .populate("category", "name")
                .limit(4)
                .lean(),

            Offer.find({
                isActive: true,
                validFrom: { $lte: now },
                validTo: { $gte: today }
            })
                .populate("productId", "productName")
                .populate("categoryId", "name")
                .sort({ createdAt: -1 })
                .lean(),

            Order.aggregate([
                {
                    $match: {
                        $or: [
                            { paymentStatus: "completed" },
                            {
                                paymentMethod: "COD",
                                orderStatus: "delivered"
                            }
                        ],
                        orderStatus: {
                            $nin: ["payment_failed", "cancelled"]
                        }
                    }
                },
                { $unwind: "$products" },
                {
                    $match: {
                        "products.status": {
                            $nin: [
                                "cancelled",
                                "returned",
                                "return_requested",
                                "partially_returned"
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$products.productId",
                        totalSold: {
                            $sum: "$products.quantity"
                        }
                    }
                },
                { $sort: { totalSold: -1 } }
            ])
        ]);

        // Apply the best active offer to a product.
        const applyOffers = (product) => {
            const basePrice = Number(
                product.variants?.[0]?.salePrice ??
                product.variants?.[0]?.regularPrice ??
                0
            );

            const applicableOffers = activeOffers.filter(offer => {
                if (offer.offerType === "product") {
                    return String(offer.productId?._id) ===
                        String(product._id);
                }

                if (offer.offerType === "category") {
                    return String(offer.categoryId?._id) ===
                        String(product.category?._id);
                }

                return false;
            });

            const bestOffer = applicableOffers.reduce(
                (best, current) => {
                    if (
                        !best ||
                        current.discountPercentage >
                            best.discountPercentage
                    ) {
                        return current;
                    }

                    return best;
                },
                null
            );

            const offerPrice = bestOffer
                ? Math.round(
                    basePrice *
                    (1 - bestOffer.discountPercentage / 100)
                )
                : basePrice;

            return {
                ...product,
                basePrice,
                offerPrice,
                appliedOffer: bestOffer
            };
        };

        // Keep your existing product section working.
        const productsWithOffers = products.map(applyOffers);

        // Fetch actual best-selling products in sales order.
        const soldProductIds = salesData.map(item => item._id);

        let topSellingProducts = [];

        if (soldProductIds.length > 0) {
            const soldProducts = await Product.find({
                _id: { $in: soldProductIds },
                isBlocked: false
            })
                .populate("category", "name")
                .lean();

            const productMap = new Map(
                soldProducts.map(product => [
                    String(product._id),
                    product
                ])
            );

            topSellingProducts = salesData
                .map(item => productMap.get(String(item._id)))
                .filter(Boolean)
                .slice(0, 4)
                .map(applyOffers);
        }

        const homepageOffers = activeOffers.filter(
            offer => offer.showOnHomepage
        );

        const brands = await Product.distinct("brand", {
            isBlocked: false
        });

        const recentReviews = await Review.find({
            rating: { $gte: 1, $lte: 5 },
            comment: { $exists: true, $ne: "" }
        })
            .populate("userId", "name")
            .populate("productId", "productName")
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();


        return res.render("user/home", {
            products: productsWithOffers,
            topSellingProducts,
            homepageOffers,
            brands,
            recentReviews
        });

    } catch (error) {
        console.error("Load home error:", error);
        return res.status(500).send("Unable to load homepage.");
    }
};


const logout = (req, res) => {

    delete req.session.user;

    req.logout(function (err) {

        if (err) {
            console.log(err);
        }

        req.session.save(() => {
            res.redirect("/user/login");
        });

    });

};

const loadSignup = (req, res) => {
    const referralCode = req.query.ref || "";

    res.render("user/signup", {
        message: null,
        referralCode
    });
};


const signup = async (req, res) => {
    try {
        let { name, email, password, phone, referralCode } = req.body;

        // Trim input fields
        name = name?.trim();
        email = email?.trim().toLowerCase();
        phone = phone?.trim();
        referralCode = referralCode?.trim().toUpperCase() || "";

        // 1. Required field validation
        if (!name || !email || !password || !phone) {
            return res.status(400).render("user/signup", {
                message: "All fields except referral code are required",
                referralCode
            });
        }

        // 2. Name validation
        if (name.length < 2 || name.length > 50) {
            return res.status(400).render("user/signup", {
                message: "Name must be between 2 and 50 characters",
                referralCode
            });
        }

        if (!/^[A-Za-z ]+$/.test(name)) {
            return res.status(400).render("user/signup", {
                message: "Name can contain only letters and spaces",
                referralCode
            });
        }

        // 3. Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).render("user/signup", {
                message: "Please enter a valid email address",
                referralCode
            });
        }

        // 4. Password validation
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).render("user/signup", {
                message:
                    "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character",
                referralCode
            });
        }

        // 5. Phone validation (10-digit Indian mobile number)
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return res.status(400).render("user/signup", {
                message: "Enter a valid 10-digit Indian mobile number",
                referralCode
            });
        }

        // 6. Check duplicate email
        const existingUser = await Users.findOne({ email });

        if (existingUser) {
            return res.status(400).render("user/signup", {
                message: "Email already registered",
                referralCode
            });
        }

        // 7. Check duplicate phone
        const existingPhone = await Users.findOne({ phone });

        if (existingPhone) {
            return res.status(400).render("user/signup", {
                message: "Phone number already registered",
                referralCode
            });
        }

        // 8. Validate referral code if provided
        let referredBy = null;

        if (referralCode) {
            const referringUser = await Users.findOne({
                referralCode
            });

            if (!referringUser) {
                return res.status(400).render("user/signup", {
                    message: "Invalid referral code",
                    referralCode
                });
            }

            referredBy = referringUser._id;
        }

        // 9. Generate a unique referral code for the new user
        let newReferralCode;

        do {
            newReferralCode = generateReferralCode(name);

            const existingReferralUser = await Users.findOne({
                referralCode: newReferralCode
            });

            if (!existingReferralUser) {
                break;
            }
        } while (true);

        // 10. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 11. Generate OTP
        const otp = generateOTP();

        // 12. Create user
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

        // 13. Create referral record
        if (referredBy) {
            await Referral.create({
                referrer: referredBy,
                referredUser: user._id,
                referralCode,
                status: "pending",
                reward: 100,
                rewardStatus: "pending"
            });
        }

        // 14. Send OTP
        await sendOTP(user.email, otp);

        req.session.tempUser = email;

        return res.redirect("/user/signup-otp");

    } catch (error) {
        console.log("SIGNUP ERROR:", error);

        return res.status(500).render("user/signup", {
            message: "Signup failed. Please try again.",
            referralCode: req.body.referralCode || ""
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

        // ======================================
        // CREATE REFERRAL AFTER OTP VERIFICATION
        // ======================================

        if (user.referredBy) {

            const existingReferral = await Referral.findOne({
                referredUser: user._id
            });

            if (!existingReferral) {

                await Referral.create({
                    referrer: user.referredBy,
                    referredUser: user._id,
                    referralCode: (
                        await Users.findById(user.referredBy)
                    ).referralCode,
                    status: "pending",
                    reward: 100,
                    rewardStatus: "pending"
                });

            }
        }

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