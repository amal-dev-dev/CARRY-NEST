import Product from "../../Model/productModel.js";
import Cart from "../../Model/cartModel.js";
import Wishlist from "../../Model/wishlistModel.js";

const MAX_QTY_PER_ITEM = 5;

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
            const qty = Math.min(Number(req.body.quantity) || 1, MAX_QTY_PER_ITEM, variant.stock);

            cart = new Cart({
                userId,
                items: [
                    {
                        productId: product._id,
                        variantId,
                        quantity: qty
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
                // Max qty validation
                if (item.quantity >= MAX_QTY_PER_ITEM) {
                    return res.status(400).json({
                        success: false,
                        message: `You can add a maximum of ${MAX_QTY_PER_ITEM} units of this item.`
                    });
                }
                // stock validation
                if (item.quantity >= variant.stock) {
                    return res.status(400).json({
                        success: false,
                        message: `Only ${variant.stock} item${variant.stock > 1 ? "s are" : " is"} available in stock.`
                    });
                }

                item.quantity++;

            } else {
                const requestedQty = Number(req.body.quantity) || 1;
                const finalQty = Math.min(requestedQty, MAX_QTY_PER_ITEM, variant.stock);

                cart.items.push({
                    productId: product._id,
                    variantId: variantId,
                    quantity: finalQty
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

        return res.json({
            success: true,
            message: "Product added to cart successfully"
        });

    } catch (error) {
        console.log("ADD CART ERROR:", error);
    }
};

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId })
            .populate("items.productId");

        if (!cart) {
            return res.render("user/cart", {
                cart: { items: [] },
                subtotal: 0,
                discount: 0,
                deliveryFee: 15,
                grandTotal: 15,
                message: null,
                cartCount: 0,
                blockedItems: []
            });
        }

        const validItems = [];
        const blockedItems = [];

        for (const item of cart.items) {

            const product = item.productId;

            // Deleted product
            if (!product) {
                continue;
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            // Invalid variant
            if (!variant) {
                continue;
            }

            const cartItem = {
                ...item.toObject(),
                productId: product,
                variant
            };

            // Keep blocked product in cart
            if (product.isBlocked) {
                blockedItems.push(cartItem);
            }

            validItems.push(cartItem);
        }

        // Don't remove blocked products
        // Only remove deleted products / invalid variants
        cart.items = validItems.map(item => ({
            productId: item.productId._id,
            variantId: item.variantId,
            quantity: item.quantity
        }));

        await cart.save();

        // Calculate total only from available products
        let subtotal = 0;

        validItems.forEach(item => {

            if (!item.productId.isBlocked) {
                subtotal += item.variant.salePrice * item.quantity;
            }

        });

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        const message = req.session.message;
        req.session.message = null;

        const cartCount = validItems.reduce(
            (sum, item) => sum + item.quantity,
            0
        );

        return res.render("user/cart", {
            cart: {
                ...cart.toObject(),
                items: validItems
            },
            blockedItems,
            subtotal,
            discount,
            deliveryFee,
            grandTotal,
            message,
            cartCount
        });

    } catch (error) {
        console.log("LOAD CART ERROR:", error);
        res.redirect("/pageNotFound");
    }
};

// helper function for totals
const calculateCartTotals = (cartItems) => {
    let subtotal = 0;

    cartItems.forEach(item => {
        if (item.variant) {
            subtotal += item.variant.salePrice * item.quantity;
        }
    });

    const discount = 0;
    const deliveryFee = 0;
    const grandTotal = subtotal - discount + deliveryFee;

    return {
        subtotal,
        discount,
        deliveryFee,
        grandTotal
    };
};

const increaseQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(
            item => item.variantId.toString() === variantId
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found"
            });
        }

        const product = await Product.findOne({
            "variants._id": variantId
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const variant = product.variants.id(variantId);

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        if (item.quantity >= MAX_QTY_PER_ITEM) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_QTY_PER_ITEM} quantity allowed per item`
            });
        }

        if (item.quantity >= variant.stock) {
            return res.status(400).json({
                success: false,
                message: "Stock limit reached"
            });
        }

        item.quantity += 1;
        await cart.save();

        // fresh cart
        const updatedCart = await Cart.findOne({ userId }).populate("items.productId");

        const cartItems = updatedCart.items.map(item => {
            const matchedVariant = item.productId?.variants?.find(
                v => v._id.toString() === item.variantId.toString()
            );

            return {
                ...item.toObject(),
                variant: matchedVariant
            };
        }).filter(item => item.productId && item.variant);

        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += item.variant.salePrice * item.quantity;
        });

        const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        const updatedItem = cartItems.find(
            item => item.variantId.toString() === variantId
        );

        return res.json({
            success: true,
            variantId,
            quantity: updatedItem.quantity,
            itemTotal: updatedItem.variant.salePrice * updatedItem.quantity,
            subtotal,
            discount,
            deliveryFee,
            grandTotal,
            cartCount
        });

    } catch (error) {
        console.log("INCREASE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const decreaseQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(
            item => item.variantId.toString() === variantId
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found"
            });
        }

        let removed = false;

        if (item.quantity === 1) {
            cart.items = cart.items.filter(
                item => item.variantId.toString() !== variantId
            );
            removed = true;
        } else {
            item.quantity -= 1;
        }

        await cart.save();

        const updatedCart = await Cart.findOne({ userId }).populate("items.productId");

        let cartItems = [];

        if (updatedCart) {
            cartItems = updatedCart.items.map(item => {
                const matchedVariant = item.productId?.variants?.find(
                    v => v._id.toString() === item.variantId.toString()
                );

                return {
                    ...item.toObject(),
                    variant: matchedVariant
                };
            }).filter(item => item.productId && item.variant);
        }

        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += item.variant.salePrice * item.quantity;
        });

        const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        if (removed) {
            return res.json({
                success: true,
                removed: true,
                variantId,
                subtotal,
                discount,
                deliveryFee,
                grandTotal,
                cartCount
            });
        }

        const updatedItem = cartItems.find(
            item => item.variantId.toString() === variantId
        );

        return res.json({
            success: true,
            removed: false,
            variantId,
            quantity: updatedItem.quantity,
            itemTotal: updatedItem.variant.salePrice * updatedItem.quantity,
            subtotal,
            discount,
            deliveryFee,
            grandTotal,
            cartCount
        });

    } catch (error) {
        console.log("DECREASE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

const removeCartItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const variantId = req.params.id;

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        cart.items = cart.items.filter(
            item => item.variantId.toString() !== variantId
        );

        await cart.save();

        const updatedCart = await Cart.findOne({ userId }).populate("items.productId");

        let cartItems = [];

        if (updatedCart) {
            cartItems = updatedCart.items.map(item => {
                const matchedVariant = item.productId?.variants?.find(
                    v => v._id.toString() === item.variantId.toString()
                );

                return {
                    ...item.toObject(),
                    variant: matchedVariant
                };
            }).filter(item => item.productId && item.variant);
        }

        const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += item.variant.salePrice * item.quantity;
        });

        const discount = 0;
        const deliveryFee = 0;
        const grandTotal = subtotal - discount + deliveryFee;

        return res.json({
            success: true,
            removed: true,
            variantId,
            subtotal,
            discount,
            deliveryFee,
            grandTotal,
            cartCount
        });

    } catch (error) {
        console.log("REMOVE CART ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};

export default {
    addToCart,
    loadCart,
    increaseQuantity,
    decreaseQuantity,
    removeCartItem
};