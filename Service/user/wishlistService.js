
import Product from "../../Model/productModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";

// 1. Toggle product in wishlist
const toggleWishlistItem = async (userId, productId, variantId) => {
    const product = await Product.findById(productId);

    if (!product) {
        return {
            success: false,
            status: 404,
            message: "Product not found"
        };
    }

    if (product.isBlocked) {
        return {
            success: false,
            status: 400,
            message: "This product is currently unavailable"
        };
    }

    if (!variantId) {
        return {
            success: false,
            status: 400,
            message: "Product variant not found"
        };
    }

    const selectedVariant = product.variants.find(
        variant => variant._id.toString() === variantId.toString()
    );

    if (!selectedVariant) {
        return {
            success: false,
            status: 400,
            message: "Selected variant not found"
        };
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        wishlist = new Wishlist({
            userId,
            items: []
        });
    }

    const existingIndex = wishlist.items.findIndex(
        item => item.productId.toString() === productId.toString()
    );

    // Remove if already in wishlist
    if (existingIndex !== -1) {
        wishlist.items.splice(existingIndex, 1);
        await wishlist.save();

        return {
            success: true,
            action: "removed",
            added: false,
            message: "Product removed from wishlist",
            wishlistCount: wishlist.items.length
        };
    }

    // Maximum 5 products
    if (wishlist.items.length >= 5) {
        return {
            success: false,
            status: 400,
            action: "limit",
            added: false,
            message: "You can add only 5 products to your wishlist"
        };
    }

    wishlist.items.push({
        productId: product._id,
        variantId: selectedVariant._id
    });

    await wishlist.save();

    return {
        success: true,
        action: "added",
        added: true,
        message: "Product added to wishlist",
        wishlistCount: wishlist.items.length
    };
};

// 2. Get wishlist page data and clean invalid entries
const getWishlistPageData = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId })
        .populate("items.productId");

    if (!wishlist) {
        return {
            wishlistItems: []
        };
    }

    const wishlistItems = [];
    const validWishlistItems = [];

    for (const item of wishlist.items) {
        const product = item.productId;

        // Product deleted or variant missing
        if (!product || !item.variantId) {
            continue;
        }

        const variant = product.variants.find(
            v => v._id.toString() === item.variantId.toString()
        );

        if (!variant) {
            console.log(
                "Removing invalid wishlist variant:",
                item.variantId,
                "Product:",
                product.productName
            );
            continue;
        }

        // Keep valid wishlist database entries
        validWishlistItems.push({
            productId: product._id,
            variantId: variant._id
        });

        wishlistItems.push({
            productId: product._id,
            variantId: variant._id,
            productName: product.productName,
            brand: product.brand,
            image: product.productImage?.[0],
            offer: product.offer,
            category: product.category,
            size: variant.size,
            stock: variant.stock,
            regularPrice: variant.regularPrice,
            salePrice: variant.salePrice
        });
    }

    // Save cleanup
    if (validWishlistItems.length !== wishlist.items.length) {
        wishlist.items = validWishlistItems;
        await wishlist.save();
    }

    return {
        wishlistItems
    };
};

// 3. Remove product from wishlist
const removeWishlistProduct = async (userId, productId) => {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        return {
            success: true
        };
    }

    wishlist.items = wishlist.items.filter(
        item => item.productId.toString() !== productId.toString()
    );

    await wishlist.save();

    return {
        success: true
    };
};

// 4. Move wishlist items to cart
const moveWishlistToCart = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist || wishlist.items.length === 0) {
        return {
            success: true,
            empty: true,
            addedCount: 0,
            unavailableItems: []
        };
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
        cart = new Cart({
            userId,
            items: []
        });
    }

    const addedItems = [];
    const unavailableItems = [];
    const remainingWishlistItems = [];

    for (const wishItem of wishlist.items) {
        const product = await Product.findById(wishItem.productId);

        // Product deleted
        if (!product) {
            unavailableItems.push({
                name: "Product no longer available"
            });
            continue;
        }

        // Product blocked
        if (product.isBlocked) {
            unavailableItems.push({
                name: product.productName,
                reason: "Product is currently unavailable"
            });

            remainingWishlistItems.push(wishItem);
            continue;
        }

        // Find selected variant
        const variant = product.variants.find(
            v => v._id.toString() === wishItem.variantId.toString()
        );

        // Variant deleted
        if (!variant) {
            unavailableItems.push({
                name: product.productName,
                reason: "Selected variant is no longer available"
            });
            continue;
        }

        // Out of stock
        if (variant.stock <= 0) {
            unavailableItems.push({
                name: product.productName,
                reason: "Out of stock"
            });

            remainingWishlistItems.push(wishItem);
            continue;
        }

        // Check whether the variant already exists in cart
        const cartItem = cart.items.find(
            item => item.variantId.toString() === variant._id.toString()
        );

        if (cartItem) {
            if (cartItem.quantity < variant.stock) {
                cartItem.quantity++;
                addedItems.push(product.productName);
            } else {
                unavailableItems.push({
                    name: product.productName,
                    reason: "Cart quantity cannot be increased"
                });

                remainingWishlistItems.push(wishItem);
            }
        } else {
            cart.items.push({
                productId: product._id,
                variantId: variant._id,
                quantity: 1
            });

            addedItems.push(product.productName);
        }
    }

    await cart.save();

    // Keep only items that could not be moved
    wishlist.items = remainingWishlistItems;
    await wishlist.save();

    return {
        success: true,
        addedCount: addedItems.length,
        unavailableItems
    };
};

// Existing helper — preserve for other service/controller usages
const removeWishlistItem = async (userId, productId, variantId) => {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        return;
    }

    wishlist.items = wishlist.items.filter(
        item =>
            !(
                item.productId.toString() === productId.toString() &&
                item.variantId.toString() === variantId.toString()
            )
    );

    await wishlist.save();
};

export {
    toggleWishlistItem,
    getWishlistPageData,
    removeWishlistProduct,
    moveWishlistToCart,
    removeWishlistItem
};
