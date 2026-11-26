import Users from "../../Model/userModel.js";

const REFERRAL_REWARD = 100;

const getReferralPageData = async (userId) => {

    const user = await Users.findById(userId);

    if (!user) {
        return {
            success: false,
            notFound: true
        };
    }

    const referredUsers = await Users.find({
        referredBy: user._id
    })
        .sort({ createdAt: -1 })
        .select("name createdAt referralRewardReceived")
        .lean();

    const totalReferrals = referredUsers.length;

    const pendingCount = referredUsers.filter(
        referredUser => !referredUser.referralRewardReceived
    ).length;

    const earnedCount = referredUsers.filter(
        referredUser => referredUser.referralRewardReceived
    ).length;

    const pendingRewards = pendingCount * REFERRAL_REWARD;

    const totalEarned = earnedCount * REFERRAL_REWARD;

    const referralHistory = referredUsers.map(referredUser => ({
        name: referredUser.name,
        date: referredUser.createdAt,
        status: referredUser.referralRewardReceived
            ? "completed"
            : "pending",
        reward: REFERRAL_REWARD
    }));

    return {
        success: true,
        user,
        referralCode: user.referralCode,
        totalReferrals,
        pendingRewards,
        totalEarned,
        referralHistory
    };
};

export default {
    getReferralPageData
};