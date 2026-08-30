import Address from "../../Model/addressModel.js";
import Cart from "../../Model/cartModel.js";
import Order from "../../Model/orderModel.js";
import Product from "../../Model/productModel.js";
import User from '../../Model/userModel.js';

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const cart = await Cart.findOne({ userId })
            .populate("items.productId");

        // Cart does not exist
        if (!cart || cart.items.length === 0) {
            req.session.message = "Your cart is empty";
            return res.redirect("/user/cart");
        }

        // Check blocked products BEFORE modifying the cart
        const blockedProduct = cart.items.find(
            item => item.productId && item.productId.isBlocked
        );

        if (blockedProduct) {
            req.session.message =
                "A product in your cart is currently unavailable. Please remove it before checkout.";

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
        let subtotal = 0;

        validItems.forEach(item => {
            subtotal += item.variant.salePrice * item.quantity;
        });

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        // Get addresses
        const addresses = await Address.find({ userId })
            .sort({ createdAt: -1 });

        return res.render("user/checkout", {
            cart: {
                ...cart.toObject(),
                items: validItems
            },
            addresses,
            subtotal,
            discount,
            deliveryFee,
            grandTotal
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

        if (!paymentMethod) {
            req.session.message = "Please select a payment method";
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

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            req.session.message = "Cart is empty";
            return res.redirect("/user/cart");
        }

        let orderedProducts = [];
        let totalAmount = 0;

        for (const item of cart.items) {
            const product = item.productId;

            // skip deleted/blocked product
            if (!product || product.isBlocked) {
                continue;
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

            const price = variant.salePrice || variant.regularPrice || 0;

            orderedProducts.push({
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,
                price: price
            });

            totalAmount += price * item.quantity;
        }

        if (orderedProducts.length === 0) {
            req.session.message = "No valid products found in cart";
            return res.redirect("/user/cart");
        }

        const orderId = "CN-" + Date.now();

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);

        const order = new Order({
            orderId,
            userId,
            products: orderedProducts,
            couponId: null,
            discountApplied: 0,
            totalAmount,
            paymentMethod,
            paymentStatus: paymentMethod === "COD" ? "pending" : "completed",
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

const loadAddAddressFromCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        console.log("🔥 CHECKOUT ADD ADDRESS GET HIT");

        return res.render("user/add-address", {
            user,
            fromCheckout: true
        });

    } catch (error) {
        console.log("❌ LOAD CHECKOUT ADD ADDRESS ERROR:", error);
        return res.redirect("/user/checkout");
    }
};

const addAddressFromCheckout = async (req, res) => {
    try {
        console.log("🔥🔥 CHECKOUT ADD ADDRESS POST HIT");

        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            detailAddress,
            landmark
        } = req.body;

        console.log("BODY:", req.body);

        const newAddress = new Address({
            userId,
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            detailAddress,
            landmark
        });

        await newAddress.save();

        console.log("✅ ADDRESS SAVED FROM CHECKOUT");

        return res.redirect("/user/checkout");

    } catch (error) {
        console.log("❌ CHECKOUT ADD ADDRESS ERROR:", error);

        req.session.message = "Unable to add address";

        return res.redirect("/user/checkout");
    }
};

export default {
    loadCheckout,
    orderPlaced,
    loadAddAddressFromCheckout,
    addAddressFromCheckout

};