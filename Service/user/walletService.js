
import Wallet from "../../Model/walletModel.js";
import User from "../../Model/userModel.js";
import razorpay from "../../Config/razorpay.js";
import crypto from "crypto";

const MINIMUM_AMOUNT = 10;

// 1. Get wallet page data
const getWalletPageData = async (userId) => {
    const [user, wallet] = await Promise.all([
        User.findById(userId),
        Wallet.findOne({ userId })
    ]);

    if (!user) {
        return {
            success: false,
            notFound: true
        };
    }

    return {
        success: true,
        user,
        wallet
    };
};

// 2. Create Razorpay wallet payment order
const createWalletPayment = async (userId, amount) => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return {
            success: false,
            status: 400,
            message: "Please enter a valid amount"
        };
    }

    if (numericAmount < MINIMUM_AMOUNT) {
        return {
            success: false,
            status: 400,
            message: "Minimum amount is ₹10"
        };
    }

    const amountInPaise = Math.round(numericAmount * 100);

    if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        return {
            success: false,
            status: 400,
            message: "Invalid payment amount"
        };
    }

    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: "WALLET_" + Date.now(),
        notes: {
            userId: String(userId),
            purpose: "wallet_topup"
        }
    };

    const order = await razorpay.orders.create(options);

    return {
        success: true,
        order
    };
};

// 3. Verify Razorpay payment and credit wallet
const verifyWalletPayment = async (userId, paymentData) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = paymentData;

    if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
    ) {
        return {
            success: false,
            status: 400,
            message: "Payment details are incomplete"
        };
    }

    // Validate signature format before comparing
    if (!/^[a-f0-9]{64}$/i.test(razorpay_signature)) {
        return {
            success: false,
            status: 400,
            message: "Payment verification failed"
        };
    }

    // Generate expected signature
    const generatedSignature = crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
        )
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    // Compare signatures safely
    const generatedBuffer = Buffer.from(generatedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
        generatedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(generatedBuffer, receivedBuffer)
    ) {
        return {
            success: false,
            status: 400,
            message: "Payment verification failed"
        };
    }

    // Fetch the actual Razorpay order
    const razorpayOrder = await razorpay.orders.fetch(
        razorpay_order_id
    );

    // Verify that this order belongs to this user
    if (
        razorpayOrder.notes?.userId !== String(userId) ||
        razorpayOrder.notes?.purpose !== "wallet_topup"
    ) {
        return {
            success: false,
            status: 403,
            message: "Invalid wallet payment order"
        };
    }

    // Fetch payment details directly from Razorpay
    const payment = await razorpay.payments.fetch(
        razorpay_payment_id
    );

    // Verify payment status, order, amount and currency
    if (
        payment.order_id !== razorpay_order_id ||
        payment.status !== "captured" ||
        payment.amount !== razorpayOrder.amount ||
        payment.currency !== "INR"
    ) {
        return {
            success: false,
            status: 400,
            message: "Payment has not been successfully captured"
        };
    }

    const amount = razorpayOrder.amount / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            status: 400,
            message: "Invalid payment amount"
        };
    }

    // Ensure wallet exists
    try {
        await Wallet.updateOne(
            { userId },
            {
                $setOnInsert: {
                    userId,
                    balance: 0,
                    transactions: []
                }
            },
            { upsert: true }
        );
    } catch (error) {
        // Another simultaneous request may have created the wallet
        if (error.code !== 11000) {
            throw error;
        }
    }

    // Atomically credit the wallet only once per payment ID
    const wallet = await Wallet.findOneAndUpdate(
        {
            userId,
            transactions: {
                $not: {
                    $elemMatch: {
                        razorpayPaymentId: razorpay_payment_id
                    }
                }
            }
        },
        {
            $inc: {
                balance: amount
            },
            $push: {
                transactions: {
                    type: "credit",
                    amount,
                    description: "Added money to wallet",
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id
                }
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!wallet) {
        return {
            success: false,
            status: 409,
            message: "Payment already processed"
        };
    }

    return {
        success: true,
        balance: wallet.balance
    };
};

export default {
    getWalletPageData,
    createWalletPayment,
    verifyWalletPayment
};
