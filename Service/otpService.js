const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const otpExpiryTime = () => {
  return Date.now() + 2 * 60 * 1000; // 5 minutes
};

export { generateOTP, otpExpiryTime };