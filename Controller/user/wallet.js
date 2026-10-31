import Wallet from "../../Model/walletModel.js";
import User from "../../Model/userModel.js";
import razorpay from "../../Config/razorpay.js";
import crypto from "crypto";

const loadWallet = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        const wallet = await Wallet.findOne({ userId });

        res.render("user/wallet", {
            user,
            wallet,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {

        console.log("LOAD WALLET ERROR:", error);

        res.redirect("/pageNotFound");
    }
};

const createWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const amount = Number(req.body.amount);

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid amount"
            });
        }

        if (amount < 10) {
            return res.status(400).json({
                success: false,
                message: "Minimum amount is ₹10"
            });
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: "WALLET_" + Date.now()
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {

        console.log("CREATE WALLET PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create payment"
        });
    }
};

const verifyWalletPayment = async (req, res) => {
    try {

        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;


        // Generate signature
        const generatedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                razorpay_order_id +
                "|" +
                razorpay_payment_id
            )
            .digest("hex");


        // Verify signature
        if (generatedSignature !== razorpay_signature) {

            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });

        }


        // Get Razorpay order from server
        const razorpayOrder =
            await razorpay.orders.fetch(razorpay_order_id);


        const amount = razorpayOrder.amount / 100;


        if (!amount || amount <= 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid payment amount"
            });

        }


        // Find wallet
        let wallet = await Wallet.findOne({
            userId
        });


        // Create wallet if it doesn't exist
        if (!wallet) {

            wallet = new Wallet({
                userId,
                balance: 0,
                transactions: []
            });

        }


        // Prevent duplicate payment
        const alreadyCredited =
            wallet.transactions.some(
                transaction =>
                    transaction.razorpayPaymentId ===
                    razorpay_payment_id
            );


        if (alreadyCredited) {

            return res.status(400).json({
                success: false,
                message: "Payment already processed"
            });

        }


        // Add money
        wallet.balance += amount;


        // Add transaction
        wallet.transactions.push({

            type: "credit",

            amount: amount,

            description: "Added money to wallet",

            razorpayOrderId:
                razorpay_order_id,

            razorpayPaymentId:
                razorpay_payment_id

        });


        await wallet.save();


        return res.status(200).json({

            success: true,

            message: "Money added to wallet successfully",

            balance: wallet.balance

        });


    } catch (error) {

        console.log(
            "VERIFY WALLET PAYMENT ERROR:",
            error
        );

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