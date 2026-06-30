import Product from "../../Model/productModel.js";
import Cart from "../../Model/cartModel.js";
import Wishlist from "../../Model/wishlistModel.js";

const addToCart = async (req, res) => {

    try {

        const userId = req.session.user;
        const variantId = req.body.variantId;

        // Find product using variantId
        const product = await Product.findOne({
            "variants._id": variantId
        });

        if (!product || product.isBlocked) {

            return res.json({
                success: false,
                message: "Product unavailable"
            });

        }

        // Selected Variant
        const variant = product.variants.id(variantId);

        if (!variant) {

            return res.json({
                success: false,
                message: "Variant not found"
            });

        }

        // Stock Check
        if (variant.stock <= 0) {

            return res.json({
                success: false,
                message: "Product is out of stock"
            });

        }

        // Find Cart
        let cart = await Cart.findOne({ userId });

        // Create Cart
        if (!cart) {

            cart = new Cart({

                userId,

                items: [

                    {
                        productId: product._id,
                        variantId,
                        quantity: 1
                    }

                ]

            });

        } else {

            // Find same variant
            const item = cart.items.find(item =>
                item.variantId &&
                item.variantId.toString() === variantId
            );

            if (item) {

                // Stock validation
                if (item.quantity >= variant.stock) {

                    req.session.message = "Stock limit reached";

                    return res.redirect("/user/cart");

                }

                item.quantity++;

            } else {

                cart.items.push({
                    productId: product._id,
                    variantId: variantId,
                    quantity: Number(req.body.quantity) || 1
                });

            }

        }

        await cart.save();

        // Remove product from wishlist
        const wishlist = await Wishlist.findOne({ userId });

        if (wishlist) {

            wishlist.items = wishlist.items.filter(item =>
                item.productId.toString() !== product._id.toString()
            );

            await wishlist.save();

        }

        res.redirect("/user/cart");

    } catch (error) {

        console.log("ADD CART ERROR:", error);

    }

};

const loadCart = async (req, res) => {

    try {

        const cart = await Cart.findOne({
            userId: req.session.user
        }).populate("items.productId");

        if (!cart) {

            return res.render("user/cart", {
                cart: { items: [] },
                subtotal: 0,
                discount: 0,
                deliveryFee: 15,
                grandTotal: 15,
                message: null
            });

        }

        const cartItems = cart.items.map(item => {

            const variant = item.productId.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            return {
                ...item.toObject(),
                variant
            };

        });

        // Remove deleted products
        const validItems = cartItems.filter(item => item.productId);

        let subtotal = 0;

        validItems.forEach(item => {

            subtotal += item.variant.salePrice * item.quantity;

        });

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        const message = req.session.message;
        req.session.message = null;

        res.render("user/cart", {

            cart: {
                ...cart.toObject(),
                items: validItems
            },

            subtotal,
            discount,
            deliveryFee,
            grandTotal,
            message

        });

    } catch (error) {

        console.log("LOAD CART ERROR:", error);

    }

};

const increaseQuantity = async (req, res) => {

    try {

        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId });

        if (!cart) {

            return res.redirect("/user/cart");

        }

        const item = cart.items.find(

            item => item.variantId.toString() === variantId

        );

        if (!item) {

            return res.redirect("/user/cart");

        }

        const product = await Product.findOne({
            "variants._id": variantId
        });

        if (!product) {

            return res.redirect("/user/cart");

        }

        const variant = product.variants.id(variantId);

        if (!variant) {

            return res.redirect("/user/cart");

        }

        if (item.quantity >= variant.stock) {

            req.session.message = "Stock limit reached";

            return res.redirect("/user/cart");

        }

        item.quantity++;

        await cart.save();

        res.redirect("/user/cart");

    } catch (error) {

        console.log("INCREASE ERROR:", error);

    }

};

const decreaseQuantity = async (req, res) => {

    try {

        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId });

        if (!cart) {

            return res.redirect("/user/cart");

        }

        const item = cart.items.find(

            item => item.variantId.toString() === variantId

        );

        if (!item) {

            return res.redirect("/user/cart");

        }

        if (item.quantity === 1) {

            cart.items = cart.items.filter(

                item => item.variantId.toString() !== variantId

            );

        } else {

            item.quantity--;

        }

        await cart.save();

        res.redirect("/user/cart");

    } catch (error) {

        console.log("DECREASE ERROR:", error);

    }

};

const removeCartItem = async (req, res) => {

    try {

        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId });

        if (!cart) {

            return res.redirect("/user/cart");

        }

        // Remove the selected variant
        cart.items = cart.items.filter(item =>
            item.variantId.toString() !== variantId
        );

        await cart.save();

        res.redirect("/user/cart");

    } catch (error) {

        console.log("REMOVE CART ERROR:", error);

    }

};

export default {
    addToCart,
    loadCart,
    increaseQuantity,
    decreaseQuantity,
    removeCartItem
}

