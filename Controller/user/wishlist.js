import Product from "../../Model/productModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";

const addToWishlist = async (req, res) => {

    try {

        const userId = req.session.user;
        const productId = req.params.id;

        const product = await Product.findById(productId);

        if (!product) {

            return res.json({
                success: false,
                message: "Product not found"
            });

        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {

            wishlist = new Wishlist({
                userId,
                items: [{
                    productId
                }]
            });

        } else {

            const exists = wishlist.items.find(item =>
                item.productId.toString() === productId
            );

            if (exists) {

                return res.json({
                    success: false,
                    message: "Already added to wishlist"
                });

            }

            wishlist.items.push({
                productId
            });

        }

        await wishlist.save();

        return res.json({
            success: true,
            message: "Added to wishlist"
        });

    } catch (error) {

        console.log(error);

        res.json({
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

            if (!item.productId) return;

            const product = item.productId;

        const variant = product.variants.find(v => v.stock > 0);

        wishlistItems.push({

            productId: product._id,

            variantId: variant?._id,

            productName: product.productName,

            brand: product.brand,

            image: product.productImage[0],

            offer: product.offer,

            category: product.category,

            size: variant?.size,

            stock: variant?.stock,

            regularPrice: variant?.regularPrice,

            salePrice: variant?.salePrice

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
            const variant = product.variants.find(v => v.stock > 0);

            if (!variant) continue;

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
    addToWishlist,
    loadWishlist,
    removeWishlist,
    moveAllToCart
}