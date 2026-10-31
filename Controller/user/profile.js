import Users from '../../Model/userModel.js';
import Wallet from "../../Model/walletModel.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const otpStore = {};

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// LOAD PROFILE
const loadProfile = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await Users.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const wallet = await Wallet.findOne({ userId });

        const totalReferrals = await Users.countDocuments({
            referredBy: userId
        });

        res.render('user/profile', { 
            user,
            wallet,
            totalReferrals
        });

    } catch (error) {
        console.log(error);
        res.redirect('/user/home');
    }
};

// LOAD EDIT PROFILE PAGE
const loadEditProfile = async (req, res) => {
    try {
        const user = await Users.findById(req.session.user);
        res.render('user/edit-profile', { user });
    } catch (error) {
        console.log(error);
        res.redirect('/user/profile');
    }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const {
            name,
            phone,
            email
        } = req.body;

        const image = req.file
            ? req.file.path
            : undefined;

        // Get current user
        const user = await Users.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        // -----------------------------
        // NAME VALIDATION
        // -----------------------------

        if (!name || name.trim() === "") {
            return res.render("user/edit-profile", {
                user,
                message: "Name is required"
            });
        }

        const nameRegex = /^[A-Za-z\s]+$/;

        if (!nameRegex.test(name.trim())) {
            return res.render("user/edit-profile", {
                user,
                message: "Name should contain only letters"
            });
        }

        // -----------------------------
        // PHONE VALIDATION
        // -----------------------------

        if (phone && phone.trim().length !== 10) {
            return res.render("user/edit-profile", {
                user,
                message: "Phone number must be 10 digits"
            });
        }

        // -----------------------------
        // EMAIL UPDATE VALIDATION
        // -----------------------------

        let emailUpdate = {};

        const newEmail = email
            ? email.trim().toLowerCase()
            : user.email.toLowerCase();

        const currentEmail = user.email
            .trim()
            .toLowerCase();

        // Check whether user is trying to change email
        if (newEmail !== currentEmail) {

            // Check server-side verified email
            const verifiedEmail =
                req.session.verifiedNewEmail;

            if (
                !verifiedEmail ||
                verifiedEmail !== newEmail
            ) {
                return res.render("user/edit-profile", {
                    user,
                    message: "Please verify your new email first"
                });
            }

            // Check duplicate email again
            const existingUser = await Users.findOne({
                email: newEmail,
                _id: { $ne: userId }
            });

            if (existingUser) {
                delete req.session.verifiedNewEmail;

                return res.render("user/edit-profile", {
                    user,
                    message: "Email already exists"
                });
            }

            emailUpdate.email = newEmail;
        }

        // -----------------------------
        // UPDATE USER
        // -----------------------------

        await Users.findByIdAndUpdate(
            userId,
            {
                name: name.trim(),

                phone: phone
                    ? phone.trim()
                    : "",

                ...emailUpdate,

                ...(image && {
                    profileImage: image
                })
            }
        );

        // Email verification is now consumed
        delete req.session.verifiedNewEmail;

        // -----------------------------
        // SUCCESS
        // -----------------------------

        return res.redirect("/user/profile");

    } catch (error) {

        console.error(
            "UPDATE PROFILE ERROR:",
            error
        );

        return res.redirect("/user/profile");
    }
};

const loadEmailChangePage = (req, res) => {
    res.render("user/change-email", {
        user: req.user
    });
};

const sendEmailOTP = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const {
            newEmail,
            currentPassword
        } = req.body;


        // -----------------------------------------
        // Validate input
        // -----------------------------------------

        if (!newEmail || !currentPassword) {
            return res.status(400).json({
                success: false,
                message: "Email and current password are required"
            });
        }


        // -----------------------------------------
        // Find user
        // -----------------------------------------

        const user = await Users.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // -----------------------------------------
        // Check current password
        // -----------------------------------------

        const passwordMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );


        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }


        // -----------------------------------------
        // Check same email
        // -----------------------------------------

        const normalizedEmail =
            newEmail.trim().toLowerCase();


        if (normalizedEmail === user.email.toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: "New email must be different from current email"
            });
        }


        // Check duplicate email

        const existingUser = await Users.findOne({
            email: normalizedEmail,
            _id: { $ne: userId }
        });


        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }


        // Generate OTP

        const otp = generateOTP();

        otpStore[normalizedEmail] = {
            otp: String(otp),
            userId: userId,
            expiresAt: Date.now() + 5 * 60 * 1000
        };


        // Send OTP

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: normalizedEmail,
            subject: "Carry Nest - Email Verification OTP",
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`
        });


        return res.json({
            success: true,
            message: "OTP sent successfully"
        });


    } catch (error) {

        console.error(
            "SEND EMAIL OTP ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {

        const userId = req.session.user;

        const {
            newEmail,
            otp
        } = req.body;


        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }


        const normalizedEmail =
            newEmail.trim().toLowerCase();


        const storedData =
            otpStore[normalizedEmail];


        // -----------------------------------------
        // OTP not found
        // -----------------------------------------

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: "OTP expired or not found"
            });
        }


        // -----------------------------------------
        // Check user
        // -----------------------------------------

        if (
            storedData.userId.toString() !==
            userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Invalid OTP request"
            });
        }


        // -----------------------------------------
        // Check expiry
        // -----------------------------------------

        if (Date.now() > storedData.expiresAt) {

            delete otpStore[normalizedEmail];

            return res.status(400).json({
                success: false,
                message: "OTP has expired"
            });
        }


        // -----------------------------------------
        // Verify OTP
        // -----------------------------------------

        if (storedData.otp !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }


        // -----------------------------------------
        // Check duplicate email again
        // -----------------------------------------

        const existingUser = await Users.findOne({
            email: normalizedEmail,
            _id: { $ne: userId }
        });


        if (existingUser) {

            delete otpStore[normalizedEmail];

            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }


        // -----------------------------------------
        // Store verified email in session
        // -----------------------------------------

        req.session.verifiedNewEmail =
            normalizedEmail;


        // -----------------------------------------
        // Delete OTP
        // -----------------------------------------

        delete otpStore[normalizedEmail];


        return res.json({
            success: true,
            message: "Email verified successfully"
        });


    } catch (error) {

        console.error(
            "VERIFY EMAIL OTP ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};



export default {
    loadProfile,
    loadEditProfile,   
    updateProfile,
    loadEmailChangePage,
    sendEmailOTP,
    verifyEmailOTP
};