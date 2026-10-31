import Address from "../../Model/addressModel.js";
import Cart from "../../Model/cartModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import Coupon from "../../Model/couponModel.js";
import Wallet from "../../Model/walletModel.js";
import Offer from "../../Model/offerModel.js";


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


const getActiveOffers = async () => {
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const offers = await Offer.find({
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: today }
    })
        .populate("productId", "_id")
        .populate("categoryId", "_id")
        .lean();

    return offers;
};

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
            const productCategoryId =
                product.category?._id ?? product.category;

            return String(offer.categoryId?._id) ===
                String(productCategoryId);
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
        basePrice * (1 - offerDiscountPercentage / 100) * 100
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


const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: {
                    path: "category",
                    model: "Category"
                }
            });

        // Cart does not exist
        if (!cart || cart.items.length === 0) {
            req.session.message = "Your cart is empty";
            return res.redirect("/user/cart");
        }

        // Check product and category availability
        const unavailableItem = cart.items.find(item =>
            isUnavailableProduct(item.productId)
        );

        if (unavailableItem) {
            req.session.message =
                "Your cart contains an unlisted or unavailable product. Please remove it from your cart before checkout.";

            return res.redirect("/user/cart");
        }

        const validItems = [];

        for (const item of cart.items) {

            const product = item.productId;

            // Remove deleted product
            if (!product) {
                continue;
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            // Remove invalid variant
            if (!variant) {
                continue;
            }

            // Remove out of stock / insufficient stock
            if (variant.stock <= 0 || variant.stock < item.quantity) {
                continue;
            }

            validItems.push({
                ...item.toObject(),
                productId: product,
                variant
            });
        }

        // If all items are invalid
        if (validItems.length === 0) {
            cart.items = [];
            await cart.save();

            req.session.message =
                "Unavailable items were removed from your cart.";

            return res.redirect("/user/cart");
        }

        // Save only valid items
        cart.items = validItems.map(item => ({
            productId: item.productId._id,
            variantId: item.variantId,
            quantity: item.quantity
        }));

        await cart.save();

        // Calculate subtotal

        const offers = await getActiveOffers();

        let subtotal = 0;
        let productDiscount = 0;
        let offerDiscount = 0;


        const pricedItems = validItems.map(item => {
            const pricing = getProductPricing(
                item.productId,
                item.variant,
                offers
            );

            // Subtotal uses the original regular price
            subtotal += pricing.regularPrice * item.quantity;

            // Discount from regular price to sale price
            productDiscount +=
                pricing.productDiscount * item.quantity;

            // Discount from the category/product offer
            offerDiscount +=
                pricing.offerDiscount * item.quantity;

            return {
                ...item,
                pricing
            };
        });

        // Apply any coupon already saved in the session.

        const appliedCoupon = req.session.appliedCoupon;

        const amountAfterDiscounts = Math.max(
            subtotal - productDiscount - offerDiscount,
            0
        );

        const couponDiscount = appliedCoupon
            ? Math.min(
                Number(appliedCoupon.discount || 0),
                amountAfterDiscounts
            )
            : 0;

        const deliveryFee = 0;

        const grandTotal = Math.max(
            amountAfterDiscounts - couponDiscount + deliveryFee,
            0
        );

        //Get available coupons
        const coupons = await Coupon.find({
            isActive: true,
            validFrom: { $lte: new Date() },
            validTo: { $gte: new Date() }
        }).sort({ createdAt: -1 });

        // Get addresses
        const addresses = await Address.find({ userId })
            .sort({ createdAt: -1 });

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

        const estimatedDelivery = `${formatDate(deliveryStart)} - ${formatDate(deliveryEnd)}`;

        const wallet = await Wallet.findOne({ userId }) || {
            balance: 0
        };

        const message = req.session.message;
        delete req.session.message;

        return res.render("user/checkout", {
            cart: {
                ...cart.toObject(),
                items: pricedItems
            },
            addresses,
            subtotal,
            productDiscount,
            offerDiscount,
            couponDiscount,
            deliveryFee,
            grandTotal,
            coupons,
            estimatedDelivery,
            wallet,
            message,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.log("LOAD CHECKOUT ERROR:", error);
        res.redirect("/pageNotFound");
    }
};


const orderPlaced = async (req, res) => {
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod } = req.body;

        if (!userId) {
            return res.redirect("/user/login");
        }

        if (!selectedAddress) {
            req.session.message = "Please select an address";
            return res.redirect("/user/checkout");
        }

        // FIX: use single address variable
        const address = await Address.findOne({
            _id: selectedAddress,
            userId
        });

        if (!address) {
            req.session.message = "Selected address not found";
            return res.redirect("/user/checkout");
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
            req.session.message = "Cart is empty";
            return res.redirect("/user/cart");
        }

        let orderedProducts = [];

        let subtotal = 0;
        let productDiscount = 0;
        let offerDiscount = 0;
        let totalAmount = 0;

        const offers = await getActiveOffers();

        for (const item of cart.items) {
            const product = item.productId;

            // Reject order if any product is unavailable
            if (isUnavailableProduct(product)) {
                req.session.message =
                    "A product in your cart is unlisted or unavailable. Please review your cart before placing the order.";

                return res.redirect("/user/cart");
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            // skip invalid variant
            if (!variant) {
                continue;
            }

            // stock check
            if (variant.stock < item.quantity || variant.stock <= 0) {
                req.session.message = `${product.productName} is out of stock`;
                return res.redirect("/user/cart");
            }

            const pricing = getProductPricing(
                product,
                variant,
                offers
            );

        const price = pricing.finalPrice;

            orderedProducts.push({
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,

                regularPrice: pricing.regularPrice,
                price: price,

                // Discounts per unit
                productDiscount: pricing.productDiscount,
                offerDiscount: pricing.offerDiscount
            });

            // Original subtotal before discounts
            subtotal += pricing.regularPrice * item.quantity;

            // Existing sale-price discount
            productDiscount +=
                pricing.productDiscount * item.quantity;

            // Category/product offer discount
            offerDiscount +=
                pricing.offerDiscount * item.quantity;

            // Price after product and offer discounts
            totalAmount += price * item.quantity;

        }

        if (orderedProducts.length === 0) {
            req.session.message = "No valid products found in cart";
            return res.redirect("/user/cart");
        }

        const appliedCoupon = req.session.appliedCoupon;

        let couponDiscount = 0;
        let couponId = null;

        if (appliedCoupon) {
            couponDiscount = Math.min(
                Number(appliedCoupon.discount || 0),
                totalAmount
            );

            couponId = appliedCoupon.couponId;
        }

        const finalAmount = Math.max(
            totalAmount - couponDiscount,
            0
        );

        if (!["COD", "RAZORPAY", "WALLET"].includes(paymentMethod)) {
            req.session.message = "Invalid payment method";
            return res.redirect("/user/checkout");
        }

        if (paymentMethod === "WALLET") {
            const wallet = await Wallet.findOne({ userId });

            if (!wallet) {
                req.session.message = "Wallet not found. Please try again.";
                return res.redirect("/user/checkout");
            }

            const walletBalance = Number(wallet.balance || 0);
            const orderTotal = Number(finalAmount);

            if (walletBalance < orderTotal) {
                req.session.message =
                    `Insufficient wallet balance! Available: ₹${walletBalance.toFixed(2)}, Required: ₹${orderTotal.toFixed(2)}. Please choose another payment method or add money to your wallet.`;

                return res.redirect("/user/checkout");
            }
        }

        const orderId = "CN-" + Date.now();

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);

        const order = new Order({
            orderId,
            userId,
            products: orderedProducts,

            // Saved price breakdown
            subtotal,
            productDiscount,
            offerDiscount,
            deliveryFee: 0,

            couponId,
            discountApplied: couponDiscount,

            // Final amount after all discounts
            totalAmount: finalAmount,

            paymentMethod,

            paymentStatus:
                paymentMethod === "WALLET"
                    ? "completed"
                    : "pending",

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

        // DEDUCT WALLET BALANCE
        if (paymentMethod === "WALLET") {
            const wallet = await Wallet.findOne({ userId });

            if (!wallet) {
                req.session.message = "Wallet not found";
                return res.redirect("/user/checkout");
            }

            wallet.balance -= finalAmount;

            wallet.transactions.push({
                type: "debit",
                amount: finalAmount,
                description: `Payment for Order ${order.orderId}`,
                orderId: order._id
            });

            await wallet.save();
        }

        delete req.session.appliedCoupon;

        // reduce stock
        for (const item of orderedProducts) {
            const product = await Product.findById(item.productId);

            if (!product) continue;

            const variant = product.variants.id(item.variantId);

            if (variant) {
                variant.stock -= item.quantity;
                if (variant.stock < 0) variant.stock = 0;
                await product.save();
            }
        }

        // clear cart
        cart.items = [];
        await cart.save();

        return res.render("user/order-success", { order });

    } catch (error) {
        console.log("ORDER PLACE ERROR:", error);
        res.redirect("/pageNotFound");
    }
};


const applyCoupon = async (req, res) => {
    try {

        const { couponCode } = req.body;

        if (!couponCode) {
            return res.json({
                success: false,
                message: "Please enter a coupon code"
            });
        }

        // Find coupon
        const coupon = await Coupon.findOne({
            discountCode: couponCode.trim().toUpperCase()
        });

        if (!coupon) {
            return res.json({
                success: false,
                message: "Invalid coupon code"
            });
        }

        // Check active
        if (!coupon.isActive) {
            return res.json({
                success: false,
                message: "This coupon is inactive"
            });
        }

        const now = new Date();

        // Check validity
        if (now < coupon.validFrom) {
            return res.json({
                success: false,
                message: "This coupon is not active yet"
            });
        }

        if (now > coupon.validTo) {
            return res.json({
                success: false,
                message: "This coupon has expired"
            });
        }

        // ==========================
        // LOAD USER CART
        // ==========================

        const cart = await Cart.findOne({
            userId: req.session.user
        }).populate({
            path: "items.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.json({
                success: false,
                message: "Your cart is empty"
            });
        }

        // ==========================
        // CALCULATE SUBTOTAL
        // ==========================

        const offers = await getActiveOffers();

        let subtotal = 0;
        let productDiscount = 0;
        let offerDiscount = 0;

        for (const item of cart.items) {
            const product = item.productId;

            if (isUnavailableProduct(product)) continue;

            const variant = product.variants.id(item.variantId);

            if (!variant) continue;

            const pricing = getProductPricing(
                product,
                variant,
                offers
            );

            const quantity = Number(item.quantity) || 0;

            subtotal += pricing.regularPrice * quantity;

            productDiscount +=
                pricing.productDiscount * quantity;

            offerDiscount +=
                pricing.offerDiscount * quantity;
        }

        const amountAfterOffers = Math.max(
            subtotal - productDiscount - offerDiscount,
            0
        );

        if (amountAfterOffers < coupon.minOrderDiscountAmount) {
            return res.json({
                success: false,
                message: `Minimum order amount after offers is ₹${coupon.minOrderDiscountAmount}`
            });
        }

        let couponDiscount = 0;

        if (coupon.discountType === "percentage") {
            couponDiscount =
                (amountAfterOffers * coupon.discountValue) / 100;
        } else {
            couponDiscount = coupon.discountValue;
        }

        couponDiscount = Math.min(
            couponDiscount,
            amountAfterOffers
        );

        req.session.appliedCoupon = {
            couponId: coupon._id,
            code: coupon.discountCode,
            discount: couponDiscount
        };

        return res.json({
            success: true,
            message: "Coupon applied successfully",
            couponCode: coupon.discountCode,
            discount: couponDiscount,
            subtotal,
            productDiscount,
            offerDiscount,
            grandTotal: Math.max(
                amountAfterOffers - couponDiscount,
                0
            )
        });

    } catch (error) {

        console.log("APPLY COUPON ERROR:", error);

        return res.json({
            success: false,
            message: "Unable to apply coupon"
        });
    }
};

const removeCoupon = async (req, res) => {
    try {

        delete req.session.appliedCoupon;

        return res.json({
            success: true,
            message: "Coupon removed successfully"
        });

    } catch (error) {

        console.log("REMOVE COUPON ERROR:", error);

        return res.json({
            success: false,
            message: "Unable to remove coupon"
        });
    }
};



export default {
    loadCheckout,
    orderPlaced,
    applyCoupon,
    removeCoupon
};

export { getActiveOffers, getProductPricing };