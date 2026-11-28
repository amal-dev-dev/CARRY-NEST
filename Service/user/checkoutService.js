import Cart from "../../Model/cartModel.js";
import Offer from "../../Model/offerModel.js";
import Coupon from "../../Model/couponModel.js";
import Order from "../../Model/orderModel.js";
import Address from "../../Model/addressModel.js";
import Wallet from "../../Model/walletModel.js";
import Product from "../../Model/productModel.js";
import Brand from "../../Model/brandModel.js";


const createCheckoutError = (message) => {
    const error = new Error(message);
    error.code = "CHECKOUT_VALIDATION";
    return error;
};

// Check product and category availability
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

// Get currently active offers
const getActiveOffers = async () => {
    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    return await Offer.find({
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: today }
    })
        .populate("productId", "_id")
        .populate("categoryId", "_id")
        .lean();
};

// Calculate product price and discounts
const getProductPricing = (product, variant, offers) => {
    const basePrice = Number(
        variant.salePrice ?? variant.regularPrice ?? 0
    );

    const regularPrice = Number(
        variant.regularPrice ?? basePrice
    );

    const productDiscount = Math.max(
        regularPrice - basePrice,
        0
    );

    const applicableOffers = offers.filter(offer => {
        if (offer.offerType === "product") {
            return String(offer.productId?._id) ===
                String(product._id);
        }

        if (offer.offerType === "category") {
            const categoryId =
                product.category?._id ?? product.category;

            return String(offer.categoryId?._id) ===
                String(categoryId);
        }

        return false;
    });

    const bestOffer = applicableOffers.reduce(
        (best, current) => {
            if (
                !best ||
                current.discountPercentage > best.discountPercentage
            ) {
                return current;
            }

            return best;
        },
        null
    );

    const offerDiscountPercentage =
        bestOffer?.discountPercentage || 0;

    const finalPrice = Math.round(
        basePrice *
        (1 - offerDiscountPercentage / 100) *
        100
    ) / 100;

    const offerDiscount = Math.max(
        basePrice - finalPrice,
        0
    );

    return {
        basePrice,
        regularPrice,
        productDiscount,
        offerDiscountPercentage,
        offerDiscount,
        finalPrice,
        appliedOffer: bestOffer
    };
};

// Get and validate checkout cart
// Get and validate checkout cart
const getCheckoutCart = async (userId) => {
    const cart = await Cart.findOne({ userId })
        .populate({
            path: "items.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

    if (!cart || cart.items.length === 0) {
        throw createCheckoutError("Your cart is empty");
    }

    // Get all currently active brand names
    const activeBrandNames = await Brand.find({
        isActive: true
    }).distinct("name");

    const validItems = [];

    for (const item of cart.items) {
        const product = item.productId;

        // Check product and category availability
        if (isUnavailableProduct(product)) {
            throw createCheckoutError(
                "Your cart contains an unavailable product. Please review your cart."
            );
        }

        // Check brand availability
        if (!activeBrandNames.includes(product.brand)) {
            throw createCheckoutError(
                `${product.productName} belongs to an unavailable brand. Please review your cart.`
            );
        }

        const variant = product.variants.id(item.variantId);

        if (!variant) {
            throw createCheckoutError(
                `${product.productName} has an invalid variant`
            );
        }

        if (
            variant.stock <= 0 ||
            variant.stock < item.quantity
        ) {
            throw createCheckoutError(
                `${product.productName} has insufficient stock`
            );
        }

        validItems.push({
            ...item.toObject(),
            productId: product,
            variant
        });
    }

    return { cart, validItems };
};

// Calculate checkout subtotal and discounts
const calculateCheckoutPricing = async (
    items,
    couponDiscount = 0
) => {
    const offers = await getActiveOffers();

    let subtotal = 0;
    let productDiscount = 0;
    let offerDiscount = 0;

    const pricedItems = items.map(item => {
        const pricing = getProductPricing(
            item.productId,
            item.variant,
            offers
        );

        subtotal += pricing.regularPrice * item.quantity;

        productDiscount +=
            pricing.productDiscount * item.quantity;

        offerDiscount +=
            pricing.offerDiscount * item.quantity;

        return {
            ...item,
            pricing
        };
    });

    const amountAfterDiscounts = Math.max(
        subtotal - productDiscount - offerDiscount,
        0
    );

    const validCouponDiscount = Math.min(
        Math.max(Number(couponDiscount) || 0, 0),
        amountAfterDiscounts
    );

    const deliveryFee = 0;

    const grandTotal = Math.max(
        amountAfterDiscounts - validCouponDiscount + deliveryFee,
        0
    );

    return {
        pricedItems,
        subtotal,
        productDiscount,
        offerDiscount,
        couponDiscount: validCouponDiscount,
        deliveryFee,
        grandTotal
    };
};


// Validate coupon and calculate its discount
const validateAndCalculateCoupon = async ({
    userId,
    couponCode,
    couponId,
    items
}) => {
    const query = couponId
        ? { _id: couponId }
        : { discountCode: couponCode.trim().toUpperCase() };

    const coupon = await Coupon.findOne(query);

    if (!coupon) {
        throw createCheckoutError("Invalid coupon code");
    }

    if (!coupon.isActive) {
        throw createCheckoutError("This coupon is inactive");
    }

    const now = new Date();

    if (now < coupon.validFrom) {
        throw createCheckoutError("This coupon is not active yet");
    }

    if (now > coupon.validTo) {
        throw createCheckoutError("This coupon has expired");
    }

    // Check global coupon usage limit
    if (
        coupon.usageLimit !== null &&
        coupon.usedCount >= coupon.usageLimit
    ) {
        throw createCheckoutError(
            "This coupon usage limit has been reached"
        );
    }

    // Check how many valid orders this user has placed with this coupon
    const userUsageCount = await Order.countDocuments({
        userId,
        couponId: coupon._id,
        paymentStatus: { $in: ["completed", "pending"] },
        orderStatus: { $ne: "payment_failed" }
    });

    if (userUsageCount >= coupon.userUsageLimit) {
        throw createCheckoutError(
            "You have already used this coupon the maximum number of times"
        );
    }

    // Calculate cart amount after product and offer discounts
    const pricing = await calculateCheckoutPricing(items, 0);

    const amountAfterOffers = Math.max(
        pricing.subtotal -
        pricing.productDiscount -
        pricing.offerDiscount,
        0
    );

    if (amountAfterOffers < coupon.minOrderDiscountAmount) {
        throw createCheckoutError(
            `Minimum order amount after offers is ₹${coupon.minOrderDiscountAmount}`
        );
    }

    let couponDiscount = 0;

    if (coupon.applyTo === "cart_total") {

        if (coupon.discountType === "percentage") {
            couponDiscount =
                amountAfterOffers * coupon.discountValue / 100;
        } else {
            couponDiscount = coupon.discountValue;
        }

    } else if (coupon.applyTo === "each-product") {

        for (const item of pricing.pricedItems) {
            const unitPrice = item.pricing.finalPrice;
            const quantity = Number(item.quantity);

            let itemDiscount = 0;

            if (coupon.discountType === "percentage") {
                itemDiscount =
                    unitPrice * coupon.discountValue / 100;
            } else {
                itemDiscount = coupon.discountValue;
            }

            // Apply discount to each unit of the eligible product
            couponDiscount +=
                Math.min(itemDiscount, unitPrice) * quantity;
        }
    }

    // Apply maximum discount cap when configured (> 0)
    if (coupon.maxDiscountAmount > 0) {
        couponDiscount = Math.min(
            couponDiscount,
            coupon.maxDiscountAmount
        );
    }

    // Never allow discount to exceed the cart amount
    couponDiscount = Math.min(
        couponDiscount,
        amountAfterOffers
    );

    couponDiscount = Math.round(couponDiscount * 100) / 100;

    return {
        coupon,
        couponDiscount,
        pricing,
        grandTotal: Math.max(
            amountAfterOffers - couponDiscount,
            0
        )
    };
};

const placeOrder = async (
    userId,
    selectedAddress,
    paymentMethod,
    appliedCouponId = null
) => {
    let createdOrder = null;
    let walletDebited = false;
    const deductedStocks = [];

    try {
        // 1. Validate payment method
        const allowedPaymentMethods = ["COD", "WALLET"];

        if (!allowedPaymentMethods.includes(paymentMethod)) {
            throw createCheckoutError("Invalid payment method.");
        }

        // 2. Validate selected address belongs to this user
        const address = await Address.findOne({
            _id: selectedAddress,
            userId
        });

        if (!address) {
            throw createCheckoutError("Please select a valid address.");
        }

        // 3. Get and validate cart items
        const { cart, validItems } = await getCheckoutCart(userId);

        if (!validItems.length) {
            throw createCheckoutError("Your cart is empty.");
        }

        // 4. Calculate product and offer discounts
        let pricing = await calculateCheckoutPricing(validItems, 0);
        let coupon = null;
        let couponDiscount = 0;

        // 5. Revalidate applied coupon
        if (appliedCouponId) {
            const couponResult = await validateAndCalculateCoupon({
                userId,
                couponId: appliedCouponId,
                items: validItems
            });

            coupon = couponResult.coupon;
            couponDiscount = couponResult.couponDiscount;
            pricing = couponResult.pricing;
        }

        const totalAmount = Number(
            (pricing.grandTotal - couponDiscount).toFixed(2)
        );

        if (totalAmount < 0) {
            throw createCheckoutError("Invalid order amount.");
        }

        // 6. Prepare order products
        const offers = await getActiveOffers();

        const orderProducts = validItems.map((item) => {
            const product = item.productId;
            const variant = item.variant;

            const productPricing = getProductPricing(
                product,
                variant,
                offers
            );

            return {
                productId: product._id,
                variantId: variant._id,
                quantity: item.quantity,
                regularPrice: productPricing.regularPrice,
                price: productPricing.finalPrice,
                productDiscount: productPricing.productDiscount,
                offerDiscount: productPricing.offerDiscount,
                status: "pending"
            };
        });

        // 7. Create order
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);

        createdOrder = await Order.create({
            orderId: `CN-${Date.now()}`,
            userId,
            products: orderProducts,
            couponId: coupon?._id || null,
            subtotal: pricing.subtotal,
            productDiscount: pricing.productDiscount,
            offerDiscount: pricing.offerDiscount,
            deliveryFee: pricing.deliveryFee,
            discountApplied: couponDiscount,
            totalAmount,
            paymentMethod,
            paymentStatus: paymentMethod === "WALLET"
                ? "completed"
                : "pending",
            orderStatus: "pending",
            deliveryDate,
            deliveryAddress: address.toObject()
        });

        // 8. Deduct wallet balance atomically
        if (paymentMethod === "WALLET") {
            const wallet = await Wallet.findOneAndUpdate(
                {
                    userId,
                    balance: { $gte: totalAmount }
                },
                {
                    $inc: { balance: -totalAmount },
                    $push: {
                        transactions: {
                            type: "debit",
                            amount: totalAmount,
                            description: "Order payment",
                            orderId: createdOrder._id
                        }
                    }
                },
                { returnDocument: "after" }
            );

            if (!wallet) {
                throw createCheckoutError("Insufficient wallet balance.");
            }

            walletDebited = true;
        }

        // 9. Deduct product stock
        for (const item of validItems) {
            const product = item.productId;
            const variant = item.variant;

            const stockUpdate = await Product.updateOne(
                {
                    _id: product._id,
                    variants: {
                        $elemMatch: {
                            _id: variant._id,
                            stock: { $gte: item.quantity }
                        }
                    }
                },
                {
                    $inc: {
                        "variants.$.stock": -item.quantity
                    }
                }
            );

            if (stockUpdate.modifiedCount !== 1) {
                throw createCheckoutError(
                    `${product.productName} is out of stock. Please try again.`
                );
            }

            deductedStocks.push({
                productId: product._id,
                variantId: variant._id,
                quantity: item.quantity
            });
        }

        // 10. Clear cart after successful order placement
        await Cart.updateOne(
            { _id: cart._id },
            { $set: { items: [] } }
        );

        return {
            order: createdOrder,
            totalAmount
        };

    } catch (error) {
        // Roll back stock if any stock was already deducted
        for (const item of deductedStocks) {
            await Product.updateOne(
                {
                    _id: item.productId,
                    "variants._id": item.variantId
                },
                {
                    $inc: {
                        "variants.$.stock": item.quantity
                    }
                }
            );
        }

        // Refund wallet if it was already debited
        if (walletDebited && createdOrder) {
            await Wallet.updateOne(
                { userId },
                {
                    $inc: { balance: createdOrder.totalAmount },
                    $push: {
                        transactions: {
                            type: "credit",
                            amount: createdOrder.totalAmount,
                            description: "Order payment reversal",
                            orderId: createdOrder._id
                        }
                    }
                }
            );
        }

        // Delete the order if the placement failed
        if (createdOrder) {
            await Order.deleteOne({ _id: createdOrder._id });
        }

        throw error;
    }
};


// Get active coupons
const getAvailableCoupons = async () => {
    const now = new Date();

    return await Coupon.find({
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now }
    }).sort({ createdAt: -1 });
};


const getCheckoutPageData = async (userId, appliedCouponId = null) => {

    // Get cart and validate products, variants and stock
    const { cart, validItems } = await getCheckoutCart(userId);

    let appliedCoupon = null;
    let couponDiscount = 0;
    let couponError = null;

    // Revalidate the coupon if one was previously applied
    if (appliedCouponId) {
        try {
            const couponResult = await validateAndCalculateCoupon({
                userId,
                couponId: appliedCouponId,
                items: validItems
            });

            couponDiscount = couponResult.couponDiscount;

            appliedCoupon = {
                couponId: couponResult.coupon._id,
                code: couponResult.coupon.discountCode,
                discount: couponDiscount
            };

        } catch (error) {
            if (error.code === "CHECKOUT_VALIDATION") {
                couponError = error.message;
            } else {
                throw error;
            }
        }
    }

    // Calculate checkout pricing using the revalidated discount
    const pricing = await calculateCheckoutPricing(
        validItems,
        couponDiscount
    );

    // Get available coupons
    const coupons = await getAvailableCoupons();

    // Get user addresses
    const addresses = await Address.find({ userId })
        .sort({ createdAt: -1 });

    // Get wallet balance
    const wallet = await Wallet.findOne({ userId }) || {
        balance: 0
    };

    // Calculate estimated delivery date
    const today = new Date();

    const deliveryStart = new Date(today);
    deliveryStart.setDate(today.getDate() + 5);

    const deliveryEnd = new Date(today);
    deliveryEnd.setDate(today.getDate() + 7);

    const formatDate = (date) => {
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        });
    };

    const estimatedDelivery =
        `${formatDate(deliveryStart)} - ${formatDate(deliveryEnd)}`;

    return {
        cart,
        addresses,
        pricing,
        coupons,
        wallet,
        estimatedDelivery,
        appliedCoupon,
        couponError
    };
};


export default {
    isUnavailableProduct,
    getActiveOffers,
    getProductPricing,
    getCheckoutCart,
    calculateCheckoutPricing,
    getAvailableCoupons,
    validateAndCalculateCoupon,
    placeOrder,
    getCheckoutPageData
};
