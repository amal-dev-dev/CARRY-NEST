const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const otpExpiryTime = () => {
  return Date.now() + 5 * 60 * 1000; // 5 minutes
};

export default { 
    generateOTP, 
    otpExpiryTime
};