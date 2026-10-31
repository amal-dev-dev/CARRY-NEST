import Users from "../../Model/userModel.js";

const loadReferral = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        // Logged-in user
        const user = await Users.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        // Referral code
        const referralCode = user.referralCode;

        // Referral link
        const referralLink = `${req.protocol}://${req.get("host")}/user/signup?ref=${referralCode}`;

        // Find users who registered using this user's referral
        const referredUsers = await Users.find({
            referredBy: user._id
        }).sort({ createdAt: -1 });

        // Total referrals
        const totalReferrals = referredUsers.length;

        // Currently all rewards are pending
        const pendingRewards = referredUsers.filter(
            user => !user.referralRewardReceived
        ).length * 100;

        // Total earned
        const totalEarned = referredUsers.filter(
            user => user.referralRewardReceived
        ).length * 100;

        // Format data for EJS
        const referralHistory = referredUsers.map(referredUser => {

            return {
                name: referredUser.name,
                date: referredUser.createdAt,
                status: referredUser.referralRewardReceived
                    ? "completed"
                    : "pending",
                reward: 100
            };

        });

        res.render("user/referral", {

            user,

            referralCode,

            referralLink,

            totalReferrals,

            pendingRewards,

            totalEarned,

            referralHistory,

            message: null,

            success: null

        });

    } catch (error) {

        console.error("REFERRAL PAGE ERROR:", error);

        res.redirect("/user/home");

    }
};

export default {
    loadReferral
};