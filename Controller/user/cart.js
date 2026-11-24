import {
    addItemToCart,
    getCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItemService,
    buildCartItems,
    calculateCartTotals,
    calculateCartCount
} from "../../Service/user/cartService.js";

import { removeWishlistItem } from "../../Service/user/wishlistService.js";


// ADD TO CART
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const { variantId, quantity = 1 } = req.body;

        if (!variantId) {
            return res.status(400).json({
                success: false,
                message: "Please select a product variant"
            });
        }

        const cart = await addItemToCart(userId, variantId, quantity);

        // Wishlist removal is optional cleanup.
        // Its failure should not make a successful cart addition look unsuccessful.
        try {
            const product = cart.items.find(
                item => item.variantId.toString() === variantId.toString()
            );

            if (product) {
                await removeWishlistItem(
                    userId,
                    product.productId,
                    variantId
                );
            }
        } catch (wishlistError) {
            console.error("Wishlist cleanup error:", wishlistError);
        }

        const updatedCart = await getCart(userId);
        const cartCount = calculateCartCount(updatedCart?.items || []);

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            cartCount
        });

    } catch (error) {
        console.error("Add to cart error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to add product to cart"
        });
    }
};



// ==============================
// LOAD CART
// ==============================
const loadCart = async (req, res) => {
    try {

        const message = req.session.message;
        delete req.session.message;

        const userId = req.session.user;

        const moveAllResult = req.session.moveAllResult || {
            addedCount: 0,
            unavailableItems: []
        };

        delete req.session.moveAllResult;

        const cart = await getCart(userId);

        if (!cart || cart.items.length === 0) {

            return res.render("user/cart", {
                cart: null,
                cartItems: [],
                blockedItems: [],
                availableItems: [],
                subtotal: 0,
                discount: 0,
                deliveryFee: 0,
                grandTotal: 0,
                cartCount: 0,
                hasAvailableItems: false,
                hasBlockedItems: false,
                moveAllResult
            });
        }

        const cartItems = [];
        const availableItems = [];
        const blockedItems = [];

        for (const item of cart.items) {

            const product = item.productId;

            // Product deleted
            if (!product) {
                continue;
            }

            // Find variant
            const variant = product.variants.find(
                (v) =>
                    v._id.toString() ===
                    item.variantId.toString()
            );

            // Variant deleted
            if (!variant) {
                continue;
            }

            const category = product.category;

            const isProductBlocked = product.isBlocked;

            const isCategoryUnavailable =
                !category ||
                category.isListed !== true ||
                category.isBlocked === true;

            const cartItem = {
                ...item.toObject(),
                productId: product,
                variant,
                isUnavailable: isProductBlocked || isCategoryUnavailable,
                unavailableReason: isProductBlocked
                    ? "This product is blocked by the admin."
                    : isCategoryUnavailable
                        ? "This product belongs to a blocked or unlisted category."
                        : ""
            };

            cartItems.push(cartItem);

            if (cartItem.isUnavailable) {
                blockedItems.push(cartItem);
            } else {
                availableItems.push(cartItem);
            }
        }

        // Calculate totals ONLY from available products
        const totals = await calculateCartTotals(availableItems);

        cartItems.forEach(item => {
            const pricing = totals.itemPricing[String(item.variantId)];

            if (pricing) {
                item.offerUnitPrice = pricing.unitPrice;
                item.itemTotal = pricing.itemTotal;
                item.offerDiscountPercentage =
                    pricing.offerDiscountPercentage;
                item.appliedOfferTitle = pricing.offerTitle;
            } else {
                item.offerUnitPrice = Number(item.variant.salePrice) || 0;
                item.itemTotal =
                    item.offerUnitPrice * item.quantity;
                item.offerDiscountPercentage = 0;
                item.appliedOfferTitle = "";
            }
        });

        const cartCount = calculateCartCount(cart.items);

        return res.render("user/cart", {

            cart,

            // Show ALL items in cart
            cartItems,

            blockedItems,

            availableItems,

            subtotal: totals.subtotal,

            discount: totals.discount,

            deliveryFee: totals.deliveryFee,

            grandTotal: totals.grandTotal,

            cartCount,

            // Important
            hasAvailableItems: availableItems.length > 0,

            hasBlockedItems: blockedItems.length > 0,

            moveAllResult,

            message

        });

    } catch (error) {

        console.error("Load cart error:", error);

        return res.status(500).send("Something went wrong");
    }
};


// ==============================
// INCREASE QUANTITY
// ==============================

const increaseQuantity = async (req, res) => {
    try {

        const userId = req.session.user;
        const { variantId } = req.params;


        const updatedCart = await increaseCartItem(
            userId,
            variantId
        );


        const cartItems = buildCartItems(updatedCart);


        const totals = await calculateCartTotals(cartItems);


        const cartCount = calculateCartCount(cartItems);


        // Find updated item
        const updatedItem = cartItems.find(
            (item) =>
                item.variantId.toString() ===
                variantId.toString()
        );


        return res.json({

            success: true,

             variantId,

            quantity: updatedItem
                ? updatedItem.quantity
                : 0,

            itemTotal:
                totals.itemPricing[String(variantId)]?.itemTotal || 0,

            subtotal: totals.subtotal,

            discount: totals.discount,

            deliveryFee: totals.deliveryFee,

            grandTotal: totals.grandTotal,

            cartCount

        });

    } catch (error) {

        if (error.message === "Maximum 5 quantity allowed") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error("Increase quantity error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to increase quantity"
        });
    }
};


// ==============================
// DECREASE QUANTITY
// ==============================

const decreaseQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const { variantId } = req.params;

        const result = await decreaseCartItem(userId, variantId);

        const updatedCart = result.cart;
        const cartItems = buildCartItems(updatedCart);

        const totals = await calculateCartTotals(cartItems);
        const cartCount = calculateCartCount(cartItems);

        const updatedItem = cartItems.find(
            (item) =>
                item.variantId.toString() ===
                variantId.toString()
        );

        return res.json({

            success: true,
            removed: result.removed,
            variantId,
            quantity: updatedItem ? updatedItem.quantity : 0,
            itemTotal:
                totals.itemPricing[String(variantId)]?.itemTotal || 0,
            subtotal: totals.subtotal,
            discount: totals.discount,
            deliveryFee: totals.deliveryFee,
            grandTotal: totals.grandTotal,
            cartCount

        });

    } catch (error) {
        console.error("Decrease quantity error:", error);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// ==============================
// REMOVE CART ITEM
// ==============================

const removeCartItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { variantId } = req.params;

        const updatedCart = await removeCartItemService(
            userId,
            variantId
        );

        const cartItems = buildCartItems(updatedCart);

        const totals = await calculateCartTotals(cartItems);

        const cartCount = calculateCartCount(updatedCart.items);

        return res.json({
            success: true,
            removed: true,
            variantId,
            subtotal: totals.subtotal,
            discount: totals.discount,
            deliveryFee: totals.deliveryFee,
            grandTotal: totals.grandTotal,
            cartCount
        });

    } catch (error) {
        console.error("Remove cart item error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to remove item."
        });
    }
};


export {
    addToCart,
    loadCart,
    increaseQuantity,
    decreaseQuantity,
    removeCartItem
};