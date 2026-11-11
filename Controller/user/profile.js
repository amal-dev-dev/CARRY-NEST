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

// NAME VALIDATION
const isValidName = (name) => {
    return (
        typeof name === "string" &&
        name.trim().length >= 2 &&
        name.trim().length <= 50 &&
        /^[A-Za-z][A-Za-z\s.'-]*$/.test(name.trim())
    );
};

// PHONE VALIDATION
const isValidPhone = (phone) => {
    return /^[6-9]\d{9}$/.test(phone);
};

// EMAIL VALIDATION
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

// OTP VALIDATION
const isValidOTP = (otp) => {
    return /^\d{6}$/.test(String(otp || ""));
};

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

        if (!user) {
            return res.redirect("/user/login");
        }

        return res.render("user/edit-profile", {
            user,
            message: req.query.message || null
        });

    } catch (error) {
        console.log(error);
        return res.redirect('/user/profile');
    }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await Users.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const { name, phone, email } = req.body;

        // NAME VALIDATION
        if (!isValidName(name)) {
            return res.render("user/edit-profile", {
                user,
                message: "Name must be 2-50 characters and contain valid letters"
            });
        }

        // PHONE VALIDATION
        const normalizedPhone = (phone || "").trim();

        if (
            normalizedPhone !== "" &&
            !isValidPhone(normalizedPhone)
        ) {
            return res.render("user/edit-profile", {
                user,
                message: "Enter a valid 10-digit Indian mobile number"
            });
        }

        // EMAIL VALIDATION
        const newEmail = (email || "").trim().toLowerCase();
        const currentEmail = (user.email || "").trim().toLowerCase();

        if (!isValidEmail(newEmail)) {
            return res.render("user/edit-profile", {
                user,
                message: "Enter a valid email address"
            });
        }

        let emailUpdate = {};

        // CHECK IF EMAIL CHANGED
        if (newEmail !== currentEmail) {

            const verifiedEmail = req.session.verifiedNewEmail;

            if (verifiedEmail !== newEmail) {
                return res.render("user/edit-profile", {
                    user,
                    message: "Please verify your new email first"
                });
            }

            // CHECK DUPLICATE EMAIL
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

        // PROFILE IMAGE VALIDATION (SECONDARY CHECK)
        let imageUpdate = {};

        if (req.file) {
            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.render("user/edit-profile", {
                    user,
                    message: "Only JPG, PNG and WEBP images are allowed"
                });
            }

            if (req.file.size > 2 * 1024 * 1024) {
                return res.render("user/edit-profile", {
                    user,
                    message: "Profile image must be less than 2 MB"
                });
            }

            imageUpdate.profileImage = req.file.path;
        }

        // UPDATE PROFILE
        await Users.findByIdAndUpdate(
            userId,
            {
                name: name.trim(),
                phone: normalizedPhone,
                ...emailUpdate,
                ...imageUpdate
            },
            {
                runValidators: true
            }
        );

        // CLEAR VERIFIED EMAIL AFTER SUCCESS
        delete req.session.verifiedNewEmail;

        return res.redirect("/user/profile");

    } catch (error) {
        console.error("UPDATE PROFILE ERROR:", error);

        return res.redirect("/user/profile");
    }
};

const loadEmailChangePage = async (req, res) => {
    try {
        const user = await Users.findById(req.session.user);

        if (!user) {
            return res.redirect("/user/login");
        }

        return res.render("user/change-email", { user });

    } catch (error) {
        console.error("LOAD EMAIL CHANGE PAGE ERROR:", error);
        return res.redirect("/user/profile");
    }
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

        if (
            typeof newEmail !== "string" ||
            typeof currentPassword !== "string" ||
            !newEmail.trim() ||
            !currentPassword
        ) {
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


        const normalizedEmail =  newEmail.trim().toLowerCase();

        if (
            typeof newEmail !== "string" ||
            !isValidEmail(newEmail.trim()) ||
            !isValidOTP(otp)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email and 6-digit OTP"
            });
        }

        const storedData = otpStore[normalizedEmail];


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