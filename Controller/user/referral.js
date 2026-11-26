import referralService from "../../Service/user/referralService.js";

const loadReferral = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const data = await referralService.getReferralPageData(userId);

        if (data.notFound) {
            return res.redirect("/user/login");
        }

        const referralLink = `${req.protocol}://${req.get("host")}/user/signup?ref=${data.referralCode}`;

        return res.render("user/referral", {
            ...data,
            referralLink,
            message: null,
            success: null
        });

    } catch (error) {
        console.error("REFERRAL PAGE ERROR:", error);
        return res.redirect("/user/home");
    }
};

export default {
    loadReferral
};