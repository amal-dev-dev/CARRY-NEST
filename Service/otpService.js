import crypto from "crypto";

const generateOTP = () => {
    return crypto.randomInt(100000, 1000000);
};

const otpExpiryTime = () => {
    return new Date(Date.now() + 5 * 60 * 1000);
};

export {
    generateOTP,
    otpExpiryTime
};
