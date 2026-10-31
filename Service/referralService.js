import Wallet from "../Model/walletModel.js";
import User from "../Model/userModel.js";


const processReferralReward = async (userId, orderId) => {

    try {

        // ----------------------------------------------------
        // 1. Find the referred user
        // ----------------------------------------------------

        const user = await User.findById(userId);

        if (!user) {
            return;
        }


        // ----------------------------------------------------
        // 2. Check whether this user was referred
        // ----------------------------------------------------

        if (!user.referredBy) {
            return;
        }


        // ----------------------------------------------------
        // 3. Prevent duplicate referral reward
        // ----------------------------------------------------

        if (user.referralRewardReceived) {
            return;
        }


        // ----------------------------------------------------
        // 4. Find the referrer
        // ----------------------------------------------------

        const referrer = await User.findById(
            user.referredBy
        );

        if (!referrer) {
            return;
        }


        // ----------------------------------------------------
        // 5. Reward amounts
        // ----------------------------------------------------

        const referrerReward = 100;
        const userReward = 50;


        // ----------------------------------------------------
        // 6. Find or create referrer's wallet
        // ----------------------------------------------------

        let referrerWallet =
            await Wallet.findOne({
                userId: referrer._id
            });

        if (!referrerWallet) {

            referrerWallet = new Wallet({
                userId: referrer._id,
                balance: 0,
                transactions: []
            });
        }


        // ----------------------------------------------------
        // 7. Find or create referred user's wallet
        // ----------------------------------------------------

        let userWallet =
            await Wallet.findOne({
                userId: user._id
            });

        if (!userWallet) {

            userWallet = new Wallet({
                userId: user._id,
                balance: 0,
                transactions: []
            });
        }


        // ----------------------------------------------------
        // 8. Add reward to referrer
        // ----------------------------------------------------

        referrerWallet.balance += referrerReward;

        referrerWallet.transactions.push({

            type: "credit",

            amount: referrerReward,

            description:
                `Referral reward for order ${orderId}`,

            orderId: orderId

        });


        // ----------------------------------------------------
        // 9. Add reward to referred user
        // ----------------------------------------------------

        userWallet.balance += userReward;

        userWallet.transactions.push({

            type: "credit",

            amount: userReward,

            description:
                `Referral bonus for order ${orderId}`,

            orderId: orderId

        });


        // ----------------------------------------------------
        // 10. Save wallets
        // ----------------------------------------------------

        await referrerWallet.save();

        await userWallet.save();


        // ----------------------------------------------------
        // 11. Mark referral reward as completed
        // ----------------------------------------------------

        user.referralRewardReceived = true;

        await user.save();


        console.log(
            `Referral reward completed for user ${user.email}`
        );

        console.log(
            `Referrer ${referrer.email} received ₹${referrerReward}`
        );

        console.log(
            `User ${user.email} received ₹${userReward}`
        );


    } catch (error) {

        console.log(
            "REFERRAL REWARD ERROR:",
            error
        );

        throw error;
    }
};


export default {
    processReferralReward
};