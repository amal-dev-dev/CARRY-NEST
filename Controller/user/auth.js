
import userAuthService from "../../Service/userAuthService.js";
import homeService from "../../Service/homeService.js";


const redirectWithMessage = (req, res, url, message) => {
    req.session.message = message;

    return req.session.save((error) => {
        if (error) {
            console.error("Session save error:", error);
            return res.status(500).send("Something went wrong.");
        }

        return res.redirect(303, url);
    });
};

// LOGIN PAGE
const loadLogin = (req, res) => {
    const message = req.session.message;
    delete req.session.message;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

    return res.render("user/login", { message });
};

// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userAuthService.loginUser(
            email?.trim(),
            password
        );

        req.session.user = user._id;

        return req.session.save((error) => {
            if (error) {
                console.error("Login session error:", error);

                return res.status(500).render("user/login", {
                    message: "Unable to start your session. Please try again."
                });
            }

            return res.redirect("/user/home");
        });

    } catch (error) {
        return res.status(error.statusCode || 500).render("user/login", {
            message: error.message || "Login failed. Please try again."
        });
    }
};

// HOME PAGE
const loadHome = async (req, res) => {
    try {
        const homeData = await homeService.getHomeData();

        return res.render("user/home", homeData);

    } catch (error) {
        console.error("Home page error:", error);
        return res.status(500).send("Unable to load homepage");
    }
};

// LOGOUT
const logout = (req, res) => {

    const destroyUserSession = () => {
        if (!req.session) {
            res.clearCookie("user.sid", { path: "/" });
            return res.redirect("/user/login");
        }

        req.session.destroy((error) => {
            res.clearCookie("user.sid", { path: "/" });

            if (error) {
                console.error("Session destruction error:", error);
                return res.status(500).send("Logout failed");
            }

            res.set({
                "Cache-Control": "no-store, no-cache, must-revalidate, private",
                "Pragma": "no-cache",
                "Expires": "0"
            });

            return res.redirect("/user/login");
        });
    };

    if (typeof req.logout === "function") {
        return req.logout((error) => {
            if (error) {
                console.error("Passport logout error:", error);
                return res.status(500).send("Logout failed");
            }

            destroyUserSession();
        });
    }

    return destroyUserSession();
};

// SIGNUP PAGE
const loadSignup = (req, res) => {
    const referralCode = req.query.ref || "";

    const formData = req.session.signupFormData || {};

    const message = req.session.message;

    delete req.session.signupFormData;
    delete req.session.message;

    return res.render("user/signup", {
        referralCode: formData.referralCode || referralCode,
        formData,
        message
    });
};

// SIGNUP
const signup = async (req, res) => {
    try {
        const user = await userAuthService.registerUser(req.body);

        req.session.tempUser = user.email;

        return req.session.save((error) => {
            if (error) {
                console.error("Signup session error:", error);

                return res.status(500).render("user/signup", {
                    message: "Unable to continue signup. Please try again.",
                    referralCode: req.body.referralCode || ""
                });
            }

            return res.redirect("/user/signup-otp");
        });

    } catch (error) {
        console.error("Signup error:", error);

        req.session.signupFormData = {
            name: req.body.name || "",
            email: req.body.email || "",
            phone: req.body.phone || "",
            referralCode: req.body.referralCode || ""
        };

        return redirectWithMessage(req, res, "/user/signup",
            error.message || "Signup failed. Please try again."
        );
    }
};

// VERIFY SIGNUP OTP
const verifyOTP = async (req, res) => {
    const email = req.session.tempUser;

    try {
        if (!email) {
            return res.redirect("/user/signup");
        }

        const enteredOtp = String(req.body.otp || "").trim();

        await userAuthService.verifySignupOTP(email, enteredOtp);

        delete req.session.tempUser;

        req.session.message = {
            type: "success",
            title: "Account Verified",
            text: "Account verified successfully. Please login."
        };

        return req.session.save((error) => {
            if (error) {
                console.error("OTP session save error:", error);
            }

            return res.redirect("/user/login");
        });

    } catch (error) {
        console.error("Signup OTP verification error:", error);

        return res.status(error.statusCode || 400).render("user/signup-otp", {
            email,
            message: error.message || "OTP verification failed."
        });
    }
};

// SIGNUP OTP PAGE
const loadVerifyOTP = async (req, res) => {
    try {
        const email = req.session.tempUser;

        if (!email) {
            return res.redirect("/user/signup");
        }

        const otpExpiry = await userAuthService.getSignupOtpExpiry(email);
        const message = req.session.message;

        delete req.session.message;

        return res.render("user/signup-otp", {
            email,
            otpExpiry,
            message
        });

    } catch (error) {
        console.error("Load signup OTP page error:", error);
        return res.redirect("/user/signup");
    }
};

// RESEND SIGNUP OTP
const resendOTP = async (req, res) => {
    const email = req.session.tempUser;

    try {
        if (!email) {
            return res.redirect("/user/signup");
        }

        await userAuthService.resendSignupOTP(email);

        return res.redirect("/user/signup-otp");

    } catch (error) {
        console.error("Resend signup OTP error:", error);

        return res.status(error.statusCode || 400).render("user/signup-otp", {
            email,
            message: error.message || "Unable to resend OTP."
        });
    }
};

// FORGOT PASSWORD PAGE
const loadForgotPassword = (req, res) => {
    const message = req.session.message;

    delete req.session.message;

    return res.render("user/forgot-password", {
        message
    });
};

// REQUEST PASSWORD RESET
const forgotPassword = async (req, res) => {
    try {
        const email = await userAuthService.requestPasswordReset(
            req.body.email
        );

        req.session.email = email;

        return req.session.save((error) => {
            if (error) {
                console.error("Forgot password session error:", error);
                return res.status(500).send("Unable to save session.");
            }

            return res.redirect(303, "/user/forgot-otp");
        });

        } catch (error) {
            if (error.statusCode === 404) {
                console.log("Forgot password: Email not registered.");
            } else {
                console.error("Forgot password error:", error);
            }

            req.session.message =
                error.statusCode === 404
                    ? "Email address is not registered."
                    : error.message || "Unable to process password reset.";

            return req.session.save((sessionError) => {
                if (sessionError) {
                    console.error("Session save error:", sessionError);
                    return res.status(500).send("Something went wrong.");
                }

            return res.redirect(303, "/user/forgot-password");
        });
    }
};

// VERIFY PASSWORD RESET OTP
const forgot_verifyOTP = async (req, res) => {
    const email = req.session.email;

    try {
        if (!email) {
            return res.redirect("/user/forgot-password");
        }

        const enteredOtp = String(req.body.otp || "").trim();

        await userAuthService.verifyPasswordResetOTP(email, enteredOtp);

        return res.redirect("/user/reset-password");

    } catch (error) {
        console.error("Forgot password OTP error:", error);

        return res.status(error.statusCode || 400).render("user/forgot-verify-otp", {
            email,
            message: error.message || "OTP verification failed."
        });
    }
};

// PASSWORD RESET OTP PAGE
const forgot_loadVerifyOTP = async (req, res) => {
    try {
        const email = req.session.email;

        if (!email) {
            return res.redirect("/user/forgot-password");
        }

        const otpExpiry =
            await userAuthService.getPasswordResetOtpExpiry(email);

        return res.render("user/forgot-otp", {
            email,
            otpExpiry
        });

    } catch (error) {
        console.error("Load forgot OTP page error:", error);
        return res.redirect("/user/forgot-password");
    }
};

// RESEND PASSWORD RESET OTP
const forgot_resendOTP = async (req, res) => {
    const email = req.session.email;

    try {
        if (!email) {
            return res.redirect("/user/forgot-password");
        }

        await userAuthService.resendPasswordResetOTP(email);

        return res.redirect("/user/forgot-otp");

    } catch (error) {
        console.error("Resend password OTP error:", error);

        return res.status(error.statusCode || 400).render("user/forgot-otp", {
            email,
            message: error.message || "Unable to resend OTP."
        });
    }
};

// RESET PASSWORD PAGE
const loadResetPassword = (req, res) => {
    if (!req.session.email) {
        return res.redirect("/user/forgot-password");
    }

    return res.render("user/reset-password");
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
        const email = req.session.email;

        if (!email) {
            return res.redirect("/user/forgot-password");
        }

        await userAuthService.resetUserPassword(
            email,
            req.body.newPassword
        );

        return req.session.destroy((error) => {
            res.clearCookie("user.sid", { path: "/" });

            if (error) {
                console.error("Reset password session error:", error);
            }

            return res.redirect("/user/login");
        });

    } catch (error) {
        return res.status(error.statusCode || 400).render("user/reset-password", {
            message: error.message || "Unable to reset password."
        });
    }
};

export default {
    login,
    loadLogin,
    loadHome,
    logout,
    loadSignup,
    signup,
    verifyOTP,
    loadVerifyOTP,
    resendOTP,
    forgotPassword,
    forgot_verifyOTP,
    resetPassword,
    loadForgotPassword,
    loadResetPassword,
    forgot_resendOTP,
    forgot_loadVerifyOTP
};
