import Address from "../../Model/addressModel.js";
import Cart from "../../Model/cartModel.js";
import Order from "../../Model/orderSchema.js";

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user._id || req.session.user;

        const addresses = await Address.find({ userId });

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        let cartItems = [];
        let subtotal = 0;
        const deliveryFee = 0;
        const discount = 0;

        if (cart && cart.items.length > 0) {
            cartItems = cart.items
                .filter(item => item.productId) // remove deleted products
                .map(item => {
                    const variant = item.productId.variants.find(
                        v => v._id.toString() === item.variantId.toString()
                    );

                    if (variant) {
                        subtotal += variant.salePrice * item.quantity;
                    }

                    return {
                        ...item.toObject(),
                        variant
                    };
                });
        }

        const grandTotal = subtotal - discount + deliveryFee;

        res.render("user/checkout", {
            addresses,
            cart: { items: cartItems },
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

        // -----------------------------
        // 1) Get form data
        // -----------------------------
        const { selectedAddress, paymentMethod } = req.body;

        if (!userId) {
            return res.redirect("/login");
        }

        if (!selectedAddress) {
            req.session.message = "Please select an address";
            return res.redirect("/user/checkout");
        }

        if (!paymentMethod) {
            req.session.message = "Please select a payment method";
            return res.redirect("/user/checkout");
        }

        // -----------------------------
        // 2) Find selected address
        // -----------------------------
        const address = await Address.findOne({
            _id: selectedAddress,
            userId: userId
        });

        if (!address) {
            req.session.message = "Selected address not found";
            return res.redirect("/user/checkout");
        }

        // -----------------------------
        // 3) Find user cart with products
        // -----------------------------
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            req.session.message = "Cart is empty";
            return res.redirect("/user/cart");
        }

        // -----------------------------
        // 4) Prepare ordered products + calculate total
        // -----------------------------
        let orderedProducts = [];
        let totalAmount = 0;

        for (const item of cart.items) {
            const product = item.productId;

            if (!product) continue;

            // find selected variant from product variants
            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            if (!variant) continue;

            // stock check
            if (variant.stock < item.quantity) {
                req.session.message = `${product.productName} is out of stock`;
                return res.redirect("/user/cart");
            }

            const price = variant.salePrice || variant.regularPrice || 0;
            const itemTotal = price * item.quantity;

            orderedProducts.push({
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,
                price: price
            });

            totalAmount += itemTotal;
        }

        if (orderedProducts.length === 0) {
            req.session.message = "No valid products found in cart";
            return res.redirect("/user/cart");
        }

        // -----------------------------
        // 5) Create custom order ID
        // Example: CN-1720456789012
        // -----------------------------
        const orderId = "CN-" + Date.now();

        // -----------------------------
        // 6) Delivery date (5 days from now)
        // -----------------------------
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 5);

        // -----------------------------
        // 7) Create order
        // -----------------------------
        const order = new Order({
            orderId: orderId,
            userId: userId,
            products: orderedProducts,
            couponId: null,
            discountApplied: 0,
            totalAmount: totalAmount,
            paymentMethod: paymentMethod, // COD
            paymentStatus: "pending",     // COD => pending until delivered/confirmed
            orderStatus: "pending",
            deliveryDate: deliveryDate,

            deliveryAddress: {
                name: address.fullName,
                phone: address.mobile,
                addressLine1: address.address,
                addressLine2: "",
                city: address.city,
                state: address.state,
                pincode: address.pincode
            }
        });

        await order.save();

        // -----------------------------
        // 8) Reduce stock from product variants
        // -----------------------------
        for (const item of cart.items) {
            const product = item.productId;
            if (!product) continue;

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            if (variant) {
                variant.stock -= item.quantity;
                if (variant.stock < 0) {
                    variant.stock = 0;
                }
                await product.save();
            }
        }

        // -----------------------------
        // 9) Clear cart after successful order
        // -----------------------------
        cart.items = [];
        await cart.save();

        // -----------------------------
        // 10) Render success page
        // -----------------------------
        res.render("user/order-success", { order });

    } catch (error) {
        console.log("ORDER PLACE ERROR:", error);
        res.redirect("/pageNotFound");
    }
};

export default { 
    loadCheckout,
    orderPlaced
};