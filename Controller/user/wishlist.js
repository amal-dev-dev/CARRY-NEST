import Product from "../../Model/productModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";



const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;
        const { variantId } = req.body;

        // Validate product ID and product
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.isBlocked) {
            return res.status(400).json({
                success: false,
                message: "This product is currently unavailable"
            });
        }

        // Validate variant
        if (!variantId) {
            return res.status(400).json({
                success: false,
                message: "Product variant not found"
            });
        }

        const selectedVariant = product.variants.find(
            variant => variant._id.toString() === variantId.toString()
        );

        if (!selectedVariant) {
            return res.status(400).json({
                success: false,
                message: "Selected variant not found"
            });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                items: []
            });
        }

        // Check whether this product is already in the wishlist
        const existingIndex = wishlist.items.findIndex(
            item => item.productId.toString() === productId.toString()
        );

        // Remove if already added
        if (existingIndex !== -1) {
            wishlist.items.splice(existingIndex, 1);
            await wishlist.save();

            return res.json({
                success: true,
                action: "removed",
                added: false,
                message: "Product removed from wishlist",
                wishlistCount: wishlist.items.length
            });
        }

        // Maximum 5 products
        if (wishlist.items.length >= 5) {
            return res.status(400).json({
                success: false,
                action: "limit",
                added: false,
                message: "You can add only 5 products to your wishlist"
            });
        }

        // Add product and selected variant
        wishlist.items.push({
            productId: product._id,
            variantId: selectedVariant._id
        });

        await wishlist.save();

        return res.json({
            success: true,
            action: "added",
            added: true,
            message: "Product added to wishlist",
            wishlistCount: wishlist.items.length
        });

    } catch (error) {
        console.error("TOGGLE WISHLIST ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update wishlist"
        });
    }
};



const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId })
            .populate("items.productId");

        if (!wishlist) {
            return res.render("user/wishlist", {
                wishlistItems: []
            });
        }

        const wishlistItems = [];
        const validWishlistItems = [];

        for (const item of wishlist.items) {
            const product = item.productId;

            // Remove entries whose product no longer exists
            if (!product || !item.variantId) {
                continue;
            }

            const variant = product.variants.find(
                v => v._id.toString() === item.variantId.toString()
            );

            // Remove entries whose variant no longer exists
            if (!variant) {
                console.log(
                    "Removing invalid wishlist variant:",
                    item.variantId,
                    "Product:",
                    product.productName
                );
                continue;
            }

            // Preserve valid database entries
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

        // Persist the cleanup so invalid items are not counted
        if (validWishlistItems.length !== wishlist.items.length) {
            wishlist.items = validWishlistItems;
            await wishlist.save();
        }

        return res.render("user/wishlist", {
            wishlistItems
        });

    } catch (error) {
        console.error("LOAD WISHLIST ERROR:", error);
        return res.redirect("/pageNotFound");
    }
};


const removeWishlist = async (req, res) => {

    try {

        const userId = req.session.user;
        const productId = req.params.id;

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {

            return res.redirect("/user/wishlist");

        }

        wishlist.items = wishlist.items.filter(item =>
            item.productId.toString() !== productId
        );

        await wishlist.save();

        res.redirect("/user/wishlist");

    } catch (error) {

        console.log("REMOVE WISHLIST ERROR:", error);

        res.redirect("/pageNotFound");

    }

};



const moveAllToCart = async (req, res) => {

    try {

        const userId = req.session.user;

        // Find wishlist
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist || wishlist.items.length === 0) {

            return res.redirect("/user/wishlist");

        }

        // Find cart
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

        // Process every wishlist item
        for (const wishItem of wishlist.items) {

            const product = await Product.findById(
                wishItem.productId
            );

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

                // Keep in wishlist
                remainingWishlistItems.push(wishItem);

                continue;
            }

            // Find selected variant
            const variant = product.variants.find(
                v =>
                    v._id.toString() ===
                    wishItem.variantId.toString()
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

                // Keep in wishlist
                remainingWishlistItems.push(wishItem);

                continue;
            }

            // Check whether item already exists in cart
            const cartItem = cart.items.find(
                item =>
                    item.variantId.toString() ===
                    variant._id.toString()
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

        // Save result in session
        req.session.moveAllResult = {

            addedCount: addedItems.length,

            unavailableItems

        };

        return res.redirect("/user/cart");

    } catch (error) {

        console.error("MOVE ALL ERROR:", error);

        return res.redirect("/user/wishlist");

    }

};



export default {
    toggleWishlist,
    loadWishlist,
    removeWishlist,
    moveAllToCart
}