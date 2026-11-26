import profileService from "../../Service/user/profileService.js";


// LOAD PROFILE
const loadProfile = async (req, res) => {

    try {

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const data = await profileService.getProfilePageData(userId);

        if (!data.user) {
            return res.redirect("/user/login");
        }

        return res.render("user/profile", {
            ...data
        });

    } catch (error) {

        console.log("LOAD PROFILE ERROR:", error);

        return res.redirect("/user/home");
    }
};


// LOAD EDIT PROFILE PAGE
const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await profileService.getEditProfilePageData(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        return res.render("user/edit-profile", {
            user,
            message: req.query.message || ""
        });

    } catch (error) {
        console.log("LOAD EDIT PROFILE ERROR:", error);
        return res.redirect("/user/profile");
    }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const result = await profileService.updateProfile(
            userId,
            req.body,
            req.file,
            req.session.verifiedNewEmail
        );

        if (result.notFound) {
            return res.redirect("/user/login");
        }

        if (!result.success) {

            if (result.clearVerifiedEmail) {
                delete req.session.verifiedNewEmail;
            }

            return res.render("user/edit-profile", {
                user: result.user,
                message: result.message
            });
        }

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
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await profileService.getEditProfilePageData(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        return res.render("user/change-email", {
            user,
            message: req.query.message || ""
        });

    } catch (error) {
        console.log("LOAD EMAIL CHANGE PAGE ERROR:", error);
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

        const { newEmail, currentPassword } = req.body;

        const result = await profileService.sendEmailOTP(
            userId,
            newEmail,
            currentPassword
        );

        return res.status(result.status || 200).json(result);

    } catch (error) {
        console.error("SEND EMAIL OTP ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const { newEmail, otp } = req.body;

        const result = await profileService.verifyEmailOTP(
            userId,
            newEmail,
            otp
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
            });
        }

        // STORE VERIFIED EMAIL IN SESSION
        req.session.verifiedNewEmail = result.verifiedEmail;

        return res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("VERIFY EMAIL OTP ERROR:", error);

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