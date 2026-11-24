import emailTransporter from "../../Config/email.js";

const sendOTPEmail = async (email, otp, subject = "OTP Verification") => {

    if (!email || !otp) {
        throw new Error("Email and OTP are required");
    }

    await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text: `Your OTP is ${otp}`
    });

};

export default {
    sendOTPEmail
};
