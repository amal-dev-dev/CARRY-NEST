import crypto from "crypto";
import razorpay from "../../Config/razorpay.js";

import Address from "../../Model/addressModel.js";
import Cart from "../../Model/cartModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import { getActiveOffers, getProductPricing} from "./checkout.js";
import Offer from "../../Model/offerModel.js";
import generateOrderId from "../../Service/orderIDService.js";


const isUnavailableProduct = (product) => {
    return (
        !product ||
        product.isBlocked === true ||
        product.isListed === false ||
        !product.category ||
        product.category.isListed !== true ||
        product.category.isBlocked === true
    );
};


const createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: {
                    path: "category",
                    model: "Category"
                }
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty"
            });
        }

        for (const item of cart.items) {
            const product = item.productId;

            if (isUnavailableProduct(product)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A product in your cart is unlisted or unavailable. Please return to your cart."
                });
            }

            const variant = product.variants.id(item.variantId);

            if (!variant || variant.stock < item.quantity || variant.stock <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `${product.productName} is unavailable or out of stock`
                });
            }
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: "CN_" + Date.now()
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.log("RAZORPAY CREATE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create Razorpay order"
        });
    }
};


const verifyRazorpayPayment = async (req, res) => {
    try {
        const userId = req.session.user;

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            selectedAddress
        } = req.body;

        // 1. Validate user session
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        // 2. Validate required Razorpay payment details
        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: "Missing Razorpay payment details"
            });
        }

        // 3. Verify Razorpay signature
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret) {
            console.error("RAZORPAY_KEY_SECRET is not configured");

            return res.status(500).json({
                success: false,
                message: "Payment verification is temporarily unavailable"
            });
        }

        const generatedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        // Compare signatures without a normal string comparison.
        const generatedBuffer = Buffer.from(generatedSignature, "hex");
        const receivedBuffer = Buffer.from(
            razorpay_signature,
            "hex"
        );

        if (
            generatedBuffer.length !== receivedBuffer.length ||
            !crypto.timingSafeEqual(
                generatedBuffer,
                receivedBuffer
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });
        }

        // 4. Validate the selected delivery address
        const address = await Address.findOne({
            _id: selectedAddress,
            userId
        });

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Selected address not found"
            });
        }

        // 5. Load cart and populate product categories
        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        // 6. Prepare order products and calculate totals
        const orderedProducts = [];

        let subtotal = 0;
        let productDiscount = 0;
        let offerDiscount = 0;
        let totalAmount = 0;

        const offers = await getActiveOffers();

        for (const item of cart.items) {
            const product = item.productId;

            // Reject unavailable products before creating the order.
            if (isUnavailableProduct(product)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A product in your cart is unlisted or unavailable. Please return to your cart."
                });
            }

            // Validate quantity
            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product quantity in cart"
                });
            }

            // Validate selected variant
            const variant = product.variants.id(item.variantId);

            if (!variant) {
                return res.status(400).json({
                    success: false,
                    message:
                        `${product.productName}: selected variant not found`
                });
            }

            // Validate stock
            if (
                variant.stock <= 0 ||
                variant.stock < item.quantity
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `${product.productName} is out of stock`
                });
            }

            // Calculate product price and discounts
            const pricing = getProductPricing(
                product,
                variant,
                offers
            );

            orderedProducts.push({
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,
                regularPrice: pricing.regularPrice,
                price: pricing.finalPrice,
                productDiscount: pricing.productDiscount,
                offerDiscount: pricing.offerDiscount
            });

            subtotal +=
                pricing.regularPrice * item.quantity;

            productDiscount +=
                pricing.productDiscount * item.quantity;

            offerDiscount +=
                pricing.offerDiscount * item.quantity;

            totalAmount +=
                pricing.finalPrice * item.quantity;
        }

        if (orderedProducts.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid products found in cart"
            });
        }

        // 7. Apply coupon discount
        const appliedCoupon = req.session.appliedCoupon;

        let couponDiscount = 0;
        let couponId = null;

        if (appliedCoupon) {
            couponDiscount = Number(appliedCoupon.discount) || 0;
            couponId = appliedCoupon.couponId || null;
        }

        const finalAmount = Math.max(
            totalAmount - couponDiscount,
            0
        );

        // 8. Calculate estimated delivery date
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);

        // 9. Create order
        const order = new Order({
            orderId: generateOrderId(),
            userId,

            products: orderedProducts,

            subtotal,
            productDiscount,
            offerDiscount,

            deliveryFee: 0,

            couponId,
            discountApplied: couponDiscount,
            totalAmount: finalAmount,

            paymentMethod: "RAZORPAY",
            paymentStatus: "completed",

            orderStatus: "pending",
            deliveryDate,

            deliveryAddress: {
                name: address.fullName,
                phone: address.mobile,
                addressLine1: address.address,
                addressLine2: address.detailAddress || "",
                city: address.city,
                state: address.state,
                pincode: address.pincode
            }
        });

        await order.save();

        // 10. Deduct stock
        // Do not run isUnavailableProduct() here again:
        // the products were already validated above.
        for (const item of orderedProducts) {
            const product = await Product.findById(
                item.productId
            );

            if (!product) {
                console.error(
                    `Product not found while updating stock: ${item.productId}`
                );
                continue;
            }

            const variant = product.variants.id(
                item.variantId
            );

            if (!variant) {
                console.error(
                    `Variant not found while updating stock: ${item.variantId}`
                );
                continue;
            }

            variant.stock = Math.max(
                0,
                variant.stock - item.quantity
            );

            await product.save();
        }

        // 11. Clear the cart and coupon
        cart.items = [];
        await cart.save();

        delete req.session.appliedCoupon;

        // 12. Return successful verification response
        return res.status(200).json({
            success: true,
            message: "Payment verified and order placed successfully",
            orderId: order._id
        });

    } catch (error) {
        console.error(
            "RAZORPAY VERIFY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "An error occurred while verifying the payment"
        });
    }
};

const createFailedPaymentOrder = async (req, res) => {
    try {

        const userId = req.session.user;

        const {
            selectedAddress
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: "Address is required"
            });
        }

        // ------------------------------------------------
        // FIND ADDRESS
        // ------------------------------------------------

        const address = await Address.findOne({
            _id: selectedAddress,
            userId
        });

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Selected address not found"
            });
        }

        // ------------------------------------------------
        // GET CART
        // ------------------------------------------------

        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: {
                    path: "category",
                    model: "Category"
                }
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        // ------------------------------------------------
        // PREPARE PRODUCTS
        // ------------------------------------------------

        const orderedProducts = [];

        let subtotal = 0;
        let productDiscount = 0;
        let offerDiscount = 0;
        let totalAmount = 0;

        const offers = await getActiveOffers();

        for (const item of cart.items) {
            const product = item.productId;

            if (isUnavailableProduct(product)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A product in your cart is unlisted or unavailable. Please return to your cart."
                });
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            if (!variant) {
                continue;
            }

            if (
                variant.stock <= 0 ||
                variant.stock < item.quantity
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${product.productName} is out of stock`
                });
            }

            // Use the same offer calculation as checkout
            const pricing = getProductPricing(
                product,
                variant,
                offers
            );

            orderedProducts.push({
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,

                regularPrice: pricing.regularPrice,
                price: pricing.finalPrice,

                productDiscount: pricing.productDiscount,
                offerDiscount: pricing.offerDiscount
            });

            subtotal += pricing.regularPrice * item.quantity;

            productDiscount += pricing.productDiscount * item.quantity;

            offerDiscount += pricing.offerDiscount * item.quantity;

            totalAmount += pricing.finalPrice * item.quantity;
        }


        if (orderedProducts.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid products found in cart"
            });
        }

        // ------------------------------------------------
        // COUPON
        // ------------------------------------------------

        const appliedCoupon =
            req.session.appliedCoupon;

        let couponDiscount = 0;
        let couponId = null;

        if (appliedCoupon) {
            couponDiscount =
                Number(appliedCoupon.discount || 0);

            couponId =
                appliedCoupon.couponId;
        }

        const finalAmount = Math.max(
            totalAmount - couponDiscount,
            0
        );

        // ------------------------------------------------
        // CREATE FAILED ORDER
        // ------------------------------------------------

        const orderId =
            "CN-" + Date.now();

        const deliveryDate =
            new Date();

        deliveryDate.setDate(
            deliveryDate.getDate() + 5
        );

        const order = new Order({
            orderId,
            userId,

            products: orderedProducts,

            subtotal,
            productDiscount,
            offerDiscount,

            deliveryFee: 0,

            couponId,
            discountApplied: couponDiscount,
            totalAmount: finalAmount,

            paymentMethod: "RAZORPAY",
            paymentStatus: "failed",
            orderStatus: "payment_failed",
            
            deliveryDate,

            deliveryAddress: {
                name: address.fullName,
                phone: address.mobile,
                addressLine1: address.address,
                addressLine2: address.detailAddress || "",
                city: address.city,
                state: address.state,
                pincode: address.pincode
            }
        });

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Failed payment order saved",
            orderId: order._id
        });

    } catch (error) {

        console.error(
            "CREATE FAILED PAYMENT ORDER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to save payment failure"
        });
    }
};


const loadPaymentFailed = async (req, res) => {
    try {
        const message =
            req.query.message ||
            "Your payment could not be completed.";

        const orderId = req.query.orderId || null;

        return res.render("user/payment-failed", {
            message,
            orderId
        });

    } catch (error) {
        console.log("PAYMENT FAILED PAGE ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};

const retryPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        // Find only this user's existing order
        const order = await Order.findOne({
            _id: orderId,
            userId
        }).populate({
            path: "products.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        // Allow retry only for eligible failed Razorpay orders
        if (
            order.paymentMethod !== "RAZORPAY" ||
            order.paymentStatus !== "failed" ||
            order.orderStatus !== "payment_failed"
        ) {
            return res.status(400).send(
                "This order is not eligible for payment retry"
            );
        }

        if (!order.products || order.products.length === 0) {
            return res.status(400).send(
                "No products found in this order"
            );
        }

        // Check current product and variant availability
        for (const item of order.products) {
            const product = item.productId;

            if (isUnavailableProduct(product)) {
                return res.status(400).send(
                    "A product in this order is unlisted or unavailable. Payment retry is not allowed."
                );
            }

            const variant = product.variants.id(item.variantId);

            if (
                !variant ||
                variant.stock < item.quantity
            ) {
                return res.status(400).send(
                    `${product.productName} is out of stock`
                );
            }
        }

        // Use the saved order total, never an amount from the browser
        const amount = Number(order.totalAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).send(
                "Invalid order amount"
            );
        }

        // Create a NEW Razorpay payment order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `retry_${Date.now()}`,
            notes: {
                carryNestOrderId: order._id.toString(),
                userId: userId.toString()
            }
        });

        // Save the Razorpay ID to link verification to this retry
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        return res.render("user/retry-payment", {
            order,
            razorpayOrder,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("RETRY PAYMENT ERROR:", error);

        return res.status(500).send(
            "Unable to start payment retry. Please try again."
        );
    }
};


const verifyRetryPayment = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login"
            });
        }

        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const order = await Order.findOne({
            _id: orderId,
            userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Prevent duplicate processing
        if (order.paymentStatus === "completed") {
            return res.json({
                success: true,
                orderId: order._id
            });
        }

        if (
            order.paymentStatus !== "failed" ||
            order.orderStatus !== "payment_failed" ||
            order.paymentMethod !== "RAZORPAY"
        ) {
            return res.status(400).json({
                success: false,
                message: "Order is not eligible for retry"
            });
        }

        // Ensure the payment belongs to the latest retry
        if (
            !order.razorpayOrderId ||
            order.razorpayOrderId !== razorpay_order_id
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay order"
            });
        }

        // Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        const signaturesMatch =
            typeof razorpay_signature === "string" &&
            Buffer.from(expectedSignature, "hex").length ===
                Buffer.from(razorpay_signature, "hex").length &&
            crypto.timingSafeEqual(
                Buffer.from(expectedSignature, "hex"),
                Buffer.from(razorpay_signature, "hex")
            );

        if (!signaturesMatch) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });
        }

        // Verify actual payment details with Razorpay
        const payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        if (
            payment.order_id !== razorpay_order_id ||
            payment.amount !== Math.round(order.totalAmount * 100) ||
            payment.currency !== "INR" ||
            payment.status !== "captured"
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment has not been confirmed"
            });
        }

        // Recheck stock before updating the order
        const productsToUpdate = [];

        for (const item of order.products) {

            const product = await Product.findById(item.productId)
                .populate({
                    path: "category",
                    model: "Category"
                });

            if (isUnavailableProduct(product)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A product in this order is unlisted or unavailable. Please contact support."
                });
            }

            const variant = product.variants.id(item.variantId);

            if (!variant || variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: "Stock is insufficient. Contact support."
                });
            }

            productsToUpdate.push({
                product,
                variantId: item.variantId,
                quantity: item.quantity
            });
        }

        // Reduce stock and update item statuses
        for (const entry of productsToUpdate) {
            const product = await Product.findById(entry.product._id);
            const variant = product.variants.id(entry.variantId);

            variant.stock -= entry.quantity;
            await product.save();
        }


        for (const item of order.products) {
            item.status = "pending";
        }

        order.paymentStatus = "completed";
        order.orderStatus = "pending";

        await order.save();

        // Clear purchased products from the user's cart
        const cart = await Cart.findOne({ userId });

        if (cart) {
            const purchasedVariants = new Set(
                order.products.map(item => item.variantId.toString())
            );

            cart.items = cart.items.filter(
                item => !purchasedVariants.has(item.variantId.toString())
            );

            await cart.save();
        }

        // Clear the applied coupon after successful payment
        delete req.session.appliedCoupon;

        return res.json({
            success: true,
            orderId: order._id
        });


    } catch (error) {
        console.error("VERIFY RETRY PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify payment. Please check your order status."
        });
    }
};




export default {
    createRazorpayOrder,
    verifyRazorpayPayment,
    createFailedPaymentOrder,
    loadPaymentFailed,
    retryPayment,
    verifyRetryPayment
};