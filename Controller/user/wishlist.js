import Product from "../../Model/productModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";

const toggleWishlist = async (req, res) => {

    try {

        const userId = req.session.user;
        const productId = req.params.id;
        const { variantId } = req.body;

        // Validate product
        const product = await Product.findById(productId);

        if (!product) {

            return res.json({
                success: false,
                message: "Product not found"
            });

        }

        // Validate variant
        if (!variantId) {

            return res.json({
                success: false,
                message: "Please select a size"
            });

        }

        // Check whether variant belongs to this product
        const selectedVariant = product.variants.find(
            variant => variant._id.toString() === variantId.toString()
        );

        if (!selectedVariant) {

            return res.json({
                success: false,
                message: "Selected variant not found"
            });

        }

        // Find wishlist
        let wishlist = await Wishlist.findOne({ userId });

        // Create wishlist if it doesn't exist
        if (!wishlist) {

            wishlist = new Wishlist({
                userId,
                items: [
                    {
                        productId: product._id,
                        variantId: selectedVariant._id
                    }
                ]
            });

            await wishlist.save();

            return res.json({
                success: true,
                action: "added",
                message: "Product added to wishlist"
            });
        }

        // Check whether SAME product + SAME variant already exists
        const index = wishlist.items.findIndex(item =>

            item.productId.toString() === productId.toString() &&
            item.variantId.toString() === variantId.toString()

        );

        // Remove if same product + variant exists
        if (index !== -1) {

            wishlist.items.splice(index, 1);

            await wishlist.save();

            return res.json({
                success: true,
                action: "removed",
                message: "Product removed from wishlist"
            });
        }

        // Check whether same product exists with another variant
        const existingProductIndex = wishlist.items.findIndex(item =>
            item.productId.toString() === productId.toString()
        );

        if (existingProductIndex !== -1) {

            // Update the existing wishlist item's variant
            wishlist.items[existingProductIndex].variantId =
                selectedVariant._id;

        } else {

            // Add new product + variant
            wishlist.items.push({
                productId: product._id,
                variantId: selectedVariant._id
            });

        }

        await wishlist.save();

        return res.json({
            success: true,
            action: "added",
            message: "Product added to wishlist"
        });

    } catch (error) {

        console.log("TOGGLE WISHLIST ERROR:", error);

        return res.json({
            success: false,
            message: "Internal Server Error"
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

        wishlist.items.forEach(item => {

            const product = item.productId;

            if (!product) return;

            // Old wishlist items may not have variantId
            if (!item.variantId) {

                console.log(
                    "Skipping wishlist item because variantId is missing:",
                    item.productId
                );

                return;
            }

            // Find the exact selected variant
            const variant = product.variants.find(v =>
                v._id.toString() === item.variantId.toString()
            );

            // Variant no longer exists
            if (!variant) {

                console.log(
                    "Variant not found:",
                    item.variantId
                );

                return;
            }

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

        });

        res.render("user/wishlist", {
            wishlistItems
        });

    } catch (error) {

        console.log("LOAD WISHLIST ERROR:", error);

        res.redirect("/pageNotFound");

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

        // Loop wishlist products
        for (const wishItem of wishlist.items) {

            const product = await Product.findById(wishItem.productId);

            if (!product || product.isBlocked) continue;

            // First available variant
            const variant = product.variants.find(v =>
                v._id.toString() === wishItem.variantId.toString()
            );

            if (!variant || variant.stock <= 0) continue;

            // Already exists in cart?
            const cartItem = cart.items.find(item =>
                item.variantId.toString() === variant._id.toString()
            );

            if (cartItem) {

                if (cartItem.quantity < variant.stock) {

                    cartItem.quantity++;

                }

            } else {

                cart.items.push({

                    productId: product._id,
                    variantId: variant._id,
                    quantity: 1

                });

            }

        }

        await cart.save();

        // Clear wishlist
        wishlist.items = [];

        await wishlist.save();

        res.redirect("/user/cart");

    } catch (error) {

        console.log("MOVE ALL ERROR:", error);

        res.redirect("/user/wishlist");

    }

};



export default {
    toggleWishlist,
    loadWishlist,
    removeWishlist,
    moveAllToCart
}