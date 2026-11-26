
import walletService from "../../Service/user/walletService.js";

// 1. LOAD WALLET PAGE
const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const result = await walletService.getWalletPageData(userId);

        if (!result.success) {
            return res.redirect("/user/login");
        }

        return res.render("user/wallet", {
            user: result.user,
            wallet: result.wallet,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("LOAD WALLET ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};

// 2. CREATE WALLET PAYMENT
const createWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const result = await walletService.createWalletPayment(
            userId,
            req.body.amount
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            order: result.order
        });

    } catch (error) {
        console.error("CREATE WALLET PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create payment"
        });
    }
};

// 3. VERIFY WALLET PAYMENT
const verifyWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const result = await walletService.verifyWalletPayment(
            userId,
            req.body
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Money added to wallet successfully",
            balance: result.balance
        });

    } catch (error) {
        console.error("VERIFY WALLET PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify payment"
        });
    }
};

export default {
    loadWallet,
    createWalletPayment,
    verifyWalletPayment
};
