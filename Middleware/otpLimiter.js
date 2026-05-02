import rateLimit from "express-rate-limit";

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 3 requests per minute
  message: "Too many OTP requests. Try again later."
});