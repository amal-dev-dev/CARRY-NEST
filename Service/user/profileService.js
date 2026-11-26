import Users from "../../Model/userModel.js";
import Wallet from "../../Model/walletModel.js";
import bcrypt from "bcrypt";
import emailTransporter from "../../Config/email.js";


const otpStore = {};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000);
};


const isValidName = (name) => {
    return (
        typeof name === "string" &&
        name.trim().length >= 2 &&
        name.trim().length <= 50 &&
        /^[A-Za-z][A-Za-z\s.'-]*$/.test(name.trim())
    );
};

const isValidPhone = (phone) => {
    return /^[6-9]\d{9}$/.test(phone);
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

const isValidOTP = (otp) => {
    return typeof otp === "string" && /^\d{6}$/.test(otp);
};


const getProfilePageData = async (userId) => {

    const [user, wallet, totalReferrals] = await Promise.all([

        Users.findById(userId),

        Wallet.findOne({ userId }),

        Users.countDocuments({
            referredBy: userId
        })

    ]);

    return {
        user,
        wallet,
        totalReferrals
    };
};


const updateProfile = async (userId, body, file, verifiedEmail) => {
    const user = await Users.findById(userId);

    if (!user) {
        return {
            success: false,
            notFound: true
        };
    }

    const { name, phone, email } = body;

    // NAME VALIDATION
    if (!isValidName(name)) {
        return {
            success: false,
            user,
            message: "Name must be 2-50 characters and contain valid letters"
        };
    }

    // PHONE VALIDATION
    const normalizedPhone = (phone || "").trim();

    if (
        normalizedPhone !== "" &&
        !isValidPhone(normalizedPhone)
    ) {
        return {
            success: false,
            user,
            message: "Enter a valid 10-digit Indian mobile number"
        };
    }

    // EMAIL VALIDATION
    const newEmail = (email || "").trim().toLowerCase();
    const currentEmail = (user.email || "").trim().toLowerCase();

    if (!isValidEmail(newEmail)) {
        return {
            success: false,
            user,
            message: "Enter a valid email address"
        };
    }

    let emailUpdate = {};

    // CHECK IF EMAIL CHANGED
    if (newEmail !== currentEmail) {

        if (verifiedEmail !== newEmail) {
            return {
                success: false,
                user,
                message: "Please verify your new email first"
            };
        }

        // CHECK DUPLICATE EMAIL
        const existingUser = await Users.findOne({
            email: newEmail,
            _id: { $ne: userId }
        });

        if (existingUser) {
            return {
                success: false,
                user,
                message: "Email already exists",
                clearVerifiedEmail: true
            };
        }

        emailUpdate.email = newEmail;
    }

    // PROFILE IMAGE VALIDATION
    let imageUpdate = {};

    if (file) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                success: false,
                user,
                message: "Only JPG, PNG and WEBP images are allowed"
            };
        }

        if (file.size > 2 * 1024 * 1024) {
            return {
                success: false,
                user,
                message: "Profile image must be less than 2 MB"
            };
        }

        imageUpdate.profileImage = file.path;
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

    return {
        success: true
    };
};


const getEditProfilePageData = async (userId) => {
    return await Users.findById(userId);
};


const sendEmailOTP = async (userId, newEmail, currentPassword) => {
    // VALIDATE INPUT
    if (
        typeof newEmail !== "string" ||
        typeof currentPassword !== "string" ||
        !newEmail.trim() ||
        !currentPassword
    ) {
        return {
            success: false,
            status: 400,
            message: "Email and current password are required"
        };
    }

    // FIND USER
    const user = await Users.findById(userId);

    if (!user) {
        return {
            success: false,
            status: 404,
            message: "User not found"
        };
    }

    // CHECK CURRENT PASSWORD
    const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!passwordMatch) {
        return {
            success: false,
            status: 401,
            message: "Current password is incorrect"
        };
    }

    // NORMALIZE EMAIL
    const normalizedEmail = newEmail.trim().toLowerCase();
    const currentEmail = (user.email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
        return {
            success: false,
            status: 400,
            message: "Enter a valid email address"
        };
    }

    // CHECK SAME EMAIL
    if (normalizedEmail === currentEmail) {
        return {
            success: false,
            status: 400,
            message: "New email must be different from current email"
        };
    }

    // CHECK DUPLICATE EMAIL
    const existingUser = await Users.findOne({
        email: normalizedEmail,
        _id: { $ne: userId }
    });

    if (existingUser) {
        return {
            success: false,
            status: 400,
            message: "Email already exists"
        };
    }

    // GENERATE AND STORE OTP
    const otp = String(generateOTP());

    otpStore[normalizedEmail] = {
        otp,
        userId,
        expiresAt: Date.now() + 5 * 60 * 1000
    };

    // SEND OTP EMAIL
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: normalizedEmail,
            subject: "Carry Nest - Email Verification OTP",
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`
        });
    } catch (error) {
        delete otpStore[normalizedEmail];
        throw error;
    }

    return {
        success: true,
        message: "OTP sent successfully"
    };
};


const verifyEmailOTP = async (userId, newEmail, otp) => {

    // VALIDATE INPUT
    if (
        typeof newEmail !== "string" ||
        !isValidEmail(newEmail.trim()) ||
        !isValidOTP(otp)
    ) {
        return {
            success: false,
            status: 400,
            message: "Please enter a valid email and 6-digit OTP"
        };
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    // FIND STORED OTP
    const storedData = otpStore[normalizedEmail];

    if (!storedData) {
        return {
            success: false,
            status: 400,
            message: "OTP expired or not found"
        };
    }

    // CHECK USER
    if (
        storedData.userId.toString() !== userId.toString()
    ) {
        return {
            success: false,
            status: 403,
            message: "Invalid OTP request"
        };
    }

    // CHECK EXPIRY
    if (Date.now() > storedData.expiresAt) {
        delete otpStore[normalizedEmail];

        return {
            success: false,
            status: 400,
            message: "OTP has expired"
        };
    }

    // VERIFY OTP
    if (storedData.otp !== otp) {
        return {
            success: false,
            status: 400,
            message: "Invalid OTP"
        };
    }

    // CHECK DUPLICATE EMAIL AGAIN
    const existingUser = await Users.findOne({
        email: normalizedEmail,
        _id: { $ne: userId }
    });

    if (existingUser) {
        delete otpStore[normalizedEmail];

        return {
            success: false,
            status: 400,
            message: "Email already exists"
        };
    }

    // DELETE OTP AFTER SUCCESS
    delete otpStore[normalizedEmail];

    return {
        success: true,
        verifiedEmail: normalizedEmail,
        message: "Email verified successfully"
    };
};


export default {
    getProfilePageData,
    getEditProfilePageData,
    updateProfile,
    sendEmailOTP,
    verifyEmailOTP
}