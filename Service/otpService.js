const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const otpExpiryTime = () => {
  return Date.now() + 1 * 60 * 1000; 
};

export { generateOTP, otpExpiryTime };