import crypto from "crypto";
import razorpay from "../../Config/razorpay.js";
import Address from "../../Model/addressModel.js";
import Cart from "../../Model/cartModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import checkoutService from "./checkoutService.js";
import generateOrderId from "./generateOrderId.js";

const createPaymentError = (message) => {
    const error = new Error(message);
    error.code = "PAYMENT_VALIDATION";
    return error;
};


const createRazorpayOrder = async (userId, couponId = null) => {
    // 1. Get and validate cart
    const { validItems } =
        await checkoutService.getCheckoutCart(userId);

    // 2. Calculate product and offer discounts
    const pricing =
        await checkoutService.calculateCheckoutPricing(
            validItems,
            0
        );

    // 3. Revalidate applied coupon
    let couponDiscount = 0;

    if (couponId) {
        const couponResult =
            await checkoutService.validateAndCalculateCoupon({
                userId,
                couponId,
                items: validItems
            });

        couponDiscount = couponResult.couponDiscount;
    }

    // 4. Calculate final payable amount
    const amount = Number(
        (pricing.grandTotal - couponDiscount).toFixed(2)
    );

    if (!Number.isFinite(amount) || amount <= 0) {
        throw createPaymentError("Invalid payment amount");
    }

    // 5. Create Razorpay order
    const options = {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: "CN_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    return {
        order,
        amount
    };
};


const verifyRazorpayPayment = async ({
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    selectedAddress,
    appliedCoupon
}) => {
    // 1. Validate required payment details
    if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
    ) {
        throw createPaymentError(
            "Missing Razorpay payment details"
        );
    }

    // 2. Verify Razorpay signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
        console.error("RAZORPAY_KEY_SECRET is not configured");

        const error = new Error(
            "Payment verification is temporarily unavailable"
        );

        error.code = "PAYMENT_CONFIGURATION";

        throw error;
    }

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    const generatedBuffer = Buffer.from(
        generatedSignature,
        "hex"
    );

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
        throw createPaymentError(
            "Payment verification failed"
        );
    }

    // 3. Validate selected delivery address
    const address = await Address.findOne({
        _id: selectedAddress,
        userId
    });

    if (!address) {
        throw createPaymentError(
            "Selected address not found"
        );
    }

    // 4. Load cart and populate product categories
    const cart = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        populate: {
            path: "category",
            model: "Category"
        }
    });

    if (
        !cart ||
        !cart.items ||
        cart.items.length === 0
    ) {
        throw createPaymentError("Cart is empty");
    }

    // 5. Prepare products and calculate totals
    const orderedProducts = [];

    let subtotal = 0;
    let productDiscount = 0;
    let offerDiscount = 0;
    let totalAmount = 0;

    const offers =
        await checkoutService.getActiveOffers();

    for (const item of cart.items) {
        const product = item.productId;

        // Validate product availability
        if (
            checkoutService.isUnavailableProduct(product)
        ) {
            throw createPaymentError(
                "A product in your cart is unlisted or unavailable. Please return to your cart."
            );
        }

        // Validate quantity
        if (
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
        ) {
            throw createPaymentError(
                "Invalid product quantity in cart"
            );
        }

        // Validate selected variant
        const variant = product.variants.id(
            item.variantId
        );

        if (!variant) {
            throw createPaymentError(
                `${product.productName}: selected variant not found`
            );
        }

        // Validate stock
        if (
            variant.stock <= 0 ||
            variant.stock < item.quantity
        ) {
            throw createPaymentError(
                `${product.productName} is out of stock`
            );
        }

        // Calculate product and offer pricing
        const pricing =
            checkoutService.getProductPricing(
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
        throw createPaymentError(
            "No valid products found in cart"
        );
    }

    // 6. Apply coupon from session
    let couponDiscount = 0;
    let couponId = null;

    if (appliedCoupon) {
        couponDiscount =
            Number(appliedCoupon.discount) || 0;

        couponId =
            appliedCoupon.couponId || null;
    }

    const finalAmount = Math.max(
        totalAmount - couponDiscount,
        0
    );


    // 7. Verify actual payment details with Razorpay
    let payment;

    try {
        payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );
    } catch (error) {
        console.error(
            "RAZORPAY PAYMENT FETCH ERROR:",
            error
        );

        const paymentError = new Error(
            "Unable to verify payment. Please contact support if money was deducted."
        );

        paymentError.code = "PAYMENT_VERIFICATION_UNAVAILABLE";

        throw paymentError;
    }

    const expectedAmount = Math.round(
        finalAmount * 100
    );

    if (
        payment.id !== razorpay_payment_id ||
        payment.order_id !== razorpay_order_id ||
        payment.amount !== expectedAmount ||
        payment.currency !== "INR" ||
        payment.status !== "captured" ||
        payment.captured !== true
    ) {
        throw createPaymentError(
            "Payment details do not match. Payment verification failed."
        );
    }


    // 7. Calculate delivery date
    const deliveryDate = new Date();

    deliveryDate.setDate(
        deliveryDate.getDate() + 5
    );

    // 8. Create order
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

    // 9. Deduct stock
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

    // 10. Clear cart
    cart.items = [];

    await cart.save();

    return {
        success: true,
        orderId: order._id
    };
};


const createFailedPaymentOrder = async ({
    userId,
    selectedAddress,
    razorpay_order_id,
    appliedCoupon
}) => {
    // 1. Validate required details
    if (!razorpay_order_id) {
        throw createPaymentError(
            "Razorpay order ID is required"
        );
    }

    if (!selectedAddress) {
        throw createPaymentError("Address is required");
    }

    // 2. Validate selected address
    const address = await Address.findOne({
        _id: selectedAddress,
        userId
    });

    if (!address) {
        throw createPaymentError(
            "Selected address not found"
        );
    }

    // 3. Get cart and populate product categories
    const cart = await Cart.findOne({ userId })
        .populate({
            path: "items.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

    if (!cart || cart.items.length === 0) {
        throw createPaymentError("Cart is empty");
    }

    // 4. Prepare products and calculate totals
    const orderedProducts = [];

    let subtotal = 0;
    let productDiscount = 0;
    let offerDiscount = 0;
    let totalAmount = 0;

    const offers =
        await checkoutService.getActiveOffers();

    for (const item of cart.items) {
        const product = item.productId;

        if (
            checkoutService.isUnavailableProduct(product)
        ) {
            throw createPaymentError(
                "A product in your cart is unlisted or unavailable. Please return to your cart."
            );
        }

        // Find selected variant
        const variant = product.variants.find(
            v =>
                v._id.toString() ===
                item.variantId.toString()
        );

        if (!variant) {
            continue;
        }

        // Validate stock
        if (
            variant.stock <= 0 ||
            variant.stock < item.quantity
        ) {
            throw createPaymentError(
                `${product.productName} is out of stock`
            );
        }

        // Calculate product and offer pricing
        const pricing =
            checkoutService.getProductPricing(
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
        throw createPaymentError(
            "No valid products found in cart"
        );
    }

    // 5. Apply coupon from session
    let couponDiscount = 0;
    let couponId = null;

    if (appliedCoupon) {
        couponDiscount =
            Number(appliedCoupon.discount || 0);

        couponId = appliedCoupon.couponId || null;
    }

    const finalAmount = Math.max(
        totalAmount - couponDiscount,
        0
    );

    // 6. Calculate delivery date
    const deliveryDate = new Date();

    deliveryDate.setDate(
        deliveryDate.getDate() + 5
    );

    // 7. Create failed payment order
    const order = new Order({
        orderId: "CN-" + Date.now(),
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
        razorpayOrderId: razorpay_order_id,
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

    return {
        success: true,
        orderId: order._id
    };
};


const retryPayment = async (orderId, userId) => {
    // 1. Find only this user's order
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
        const error = new Error("Order not found");
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }

    // 2. Check payment retry eligibility
    if (
        order.paymentMethod !== "RAZORPAY" ||
        order.paymentStatus !== "failed" ||
        order.orderStatus !== "payment_failed"
    ) {
        throw createPaymentError(
            "This order is not eligible for payment retry"
        );
    }

    if (!order.products || order.products.length === 0) {
        throw createPaymentError(
            "No products found in this order"
        );
    }

    // 3. Validate product and variant availability
    for (const item of order.products) {
        const product = item.productId;

        if (checkoutService.isUnavailableProduct(product)) {
            throw createPaymentError(
                "A product in this order is unlisted or unavailable. Payment retry is not allowed."
            );
        }

        const variant = product.variants.id(item.variantId);

        if (!variant || variant.stock < item.quantity) {
            throw createPaymentError(
                `${product.productName} is out of stock`
            );
        }
    }

    // 4. Use saved order amount
    const amount = Number(order.totalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw createPaymentError("Invalid order amount");
    }

    // 5. Create a new Razorpay order
    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `retry_${Date.now()}`,
        notes: {
            carryNestOrderId: order._id.toString(),
            userId: userId.toString()
        }
    });

    // 6. Save the new Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;

    await order.save();

    return {
        order,
        razorpayOrder,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    };
};



const verifyRetryPayment = async ({
    userId,
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
}) => {
    if (
        !orderId ||
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
    ) {
        throw createPaymentError("Payment details are incomplete");
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
        const error = new Error("Razorpay secret is not configured");
        error.code = "PAYMENT_CONFIGURATION";
        throw error;
    }

    const order = await Order.findOne({
        _id: orderId,
        userId
    });

    if (!order) {
        const error = new Error("Order not found");
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }

    // Prevent duplicate processing
    if (order.paymentStatus === "completed") {
        return {
            success: true,
            orderId: order._id
        };
    }

    if (
        order.paymentStatus !== "failed" ||
        order.orderStatus !== "payment_failed" ||
        order.paymentMethod !== "RAZORPAY"
    ) {
        throw createPaymentError("Order is not eligible for retry");
    }

    // Ensure payment belongs to the latest retry
    if (
        !order.razorpayOrderId ||
        order.razorpayOrderId !== razorpay_order_id
    ) {
        throw createPaymentError("Invalid Razorpay order");
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    const receivedSignature = Buffer.from(
        razorpay_signature,
        "hex"
    );

    const expectedSignatureBuffer = Buffer.from(
        expectedSignature,
        "hex"
    );

    const signaturesMatch =
        /^[a-fA-F0-9]{64}$/.test(razorpay_signature) &&
        receivedSignature.length === expectedSignatureBuffer.length &&
        crypto.timingSafeEqual(
            expectedSignatureBuffer,
            receivedSignature
        );

    if (!signaturesMatch) {
        throw createPaymentError("Payment verification failed");
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
        throw createPaymentError(
            "Payment has not been confirmed"
        );
    }

    // Recheck product availability and stock
    const productsToUpdate = [];

    for (const item of order.products) {
        const product = await Product.findById(item.productId)
            .populate({
                path: "category",
                model: "Category"
            });

        if (checkoutService.isUnavailableProduct(product)) {
            throw createPaymentError(
                "A product in this order is unlisted or unavailable. Please contact support."
            );
        }

        const variant = product.variants.id(item.variantId);

        if (!variant || variant.stock < item.quantity) {
            throw createPaymentError(
                "Stock is insufficient. Contact support."
            );
        }

        productsToUpdate.push({
            productId: product._id,
            variantId: item.variantId,
            quantity: item.quantity
        });
    }

    // Reduce stock
    for (const entry of productsToUpdate) {
        const product = await Product.findById(entry.productId);

        if (!product) {
            throw createPaymentError(
                "A product is no longer available. Please contact support."
            );
        }

        const variant = product.variants.id(entry.variantId);

        if (!variant || variant.stock < entry.quantity) {
            throw createPaymentError(
                "Stock is insufficient. Contact support."
            );
        }

        variant.stock -= entry.quantity;
        await product.save();
    }

    // Update order status
    for (const item of order.products) {
        item.status = "pending";
    }

    order.paymentStatus = "completed";
    order.orderStatus = "pending";

    await order.save();

    // Remove purchased variants from cart
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

    return {
        success: true,
        orderId: order._id
    };
};



export default {
    createRazorpayOrder,
    verifyRazorpayPayment,
    createFailedPaymentOrder,
    retryPayment,
    verifyRetryPayment
};