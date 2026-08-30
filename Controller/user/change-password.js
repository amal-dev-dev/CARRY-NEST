import bcrypt from "bcrypt";
import User from "../../Model/userModel.js";

const loadChangePassword = async (req, res) => {
    try {

        const message = req.session.message;
        const success = req.session.success;

        req.session.message = null;
        req.session.success = null;

        res.render("user/change-password", {
            message,
            success
        });

    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
};

const changePassword = async (req, res) => {
    try {

        const userId = req.session.user;

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            req.session.message = "User not found";
            return res.redirect("/user/change-password");
        }

        // Check current password
        const isMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isMatch) {
            req.session.message = "Current password is incorrect";
            return res.redirect("/user/change-password");
        }

        // Check new password and confirm password
        if (newPassword !== confirmPassword) {
            req.session.message = "New password and confirm password do not match";
            return res.redirect("/user/change-password");
        }

        // Prevent using the same password
        const isSamePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (isSamePassword) {
            req.session.message = "New password cannot be the same as the current password";
            return res.redirect("/user/change-password");
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;

        await user.save();

        req.session.success = "Password changed successfully";
        return res.redirect("/user/change-password");

    } catch (error) {

        console.log("CHANGE PASSWORD ERROR:", error);

        req.session.message = "Something went wrong";
        return res.redirect("/user/change-password");

    }
};

export default {
    loadChangePassword,
    changePassword
}