import Users from '../../Model/userModel.js';
import nodemailer from "nodemailer";
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

        if (!req.session.user) {
            return res.redirect('/user/login');
        }

        const user = await Users.findById(req.session.user);

        res.render('user/profile', { user });

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

        const { name, phone } = req.body;
        const image = req.file ? req.file.path : undefined;

        if (!name || name.trim() === "") {

            const user = await Users.findById(req.session.user);

            return res.render('user/edit-profile', {
                user,
                message: "Name is required"
            });
        }

        const nameRegex = /^[A-Za-z\s]+$/;

        if (!nameRegex.test(name.trim())) {

            const user = await Users.findById(req.session.user);

            return res.render('user/edit-profile', {
                user,
                message: "Name should contain only letters"
            });
        }

        if (phone && phone.trim().length !== 10) {

            const user = await Users.findById(req.session.user);

            return res.render('user/edit-profile', {
                user,
                message: "Phone number must be 10 digits"
            });
        }

        await Users.findByIdAndUpdate(req.session.user, {

            name: name.trim(),

            phone: phone ? phone.trim() : "",

            ...(image && { profileImage: image })

        });

        res.redirect('/user/profile');

    } catch (error) {

        console.log(error);

        res.redirect('/user/profile');
    }
};

const loadEmailChangePage = (req, res) => {
    res.render("user/change-email", {
        user: req.user
    });
};

const sendEmailOTP = async (req, res) => {
    try {
        const { newEmail } = req.body;

        const otp = generateOTP();
        otpStore[newEmail] = otp;

        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: newEmail,
            subject: "Email OTP",
            text: `Your OTP is ${otp}`
        });

        return res.json({
            success: true,
            message: "OTP sent"
        });

    } catch (error) {
        return res.json({
            success: false,
            message: "Failed to send OTP"
        });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {
        const { newEmail, otp } = req.body;
        const userId = req.session.user;

        const storedOTP = otpStore[newEmail];

        // Invalid OTP
        if (!storedOTP || storedOTP != otp) {
            return res.json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // CHECK DUPLICATE EMAIL
        const existingUser = await Users.findOne({ email: newEmail });

        if (existingUser) {
            return res.json({
                success: false,
                message: "Email already exists"
            });
        }

        await Users.findByIdAndUpdate(userId, {
            email: newEmail
        });

        delete otpStore[newEmail];

        return res.json({
            success: true,
            message: "Email updated successfully"
        });

    } catch (error) {
        return res.json({
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