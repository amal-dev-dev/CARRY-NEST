import {
    toggleWishlistItem,
    getWishlistPageData,
    removeWishlistProduct,
    moveWishlistToCart
} from "../../Service/user/wishlistService.js";


const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;
        const { variantId } = req.body;

        const result = await toggleWishlistItem(
            userId,
            productId,
            variantId
        );

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                action: result.action,
                added: result.added,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            action: result.action,
            added: result.added,
            message: result.message,
            wishlistCount: result.wishlistCount
        });

    } catch (error) {
        console.error("Toggle wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        const data = await getWishlistPageData(userId);

        return res.render("user/wishlist", {
            wishlistItems: data.wishlistItems
        });

    } catch (error) {
        console.error("Load wishlist error:", error);
        return res.redirect("/pageNotFound");
    }
};


const removeWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;

        await removeWishlistProduct(userId, productId);

        return res.redirect("/user/wishlist");

    } catch (error) {
        console.error("Remove wishlist error:", error);
        return res.redirect("/user/wishlist");
    }
};


const moveAllToCart = async (req, res) => {
    try {
        const userId = req.session.user;

        const result = await moveWishlistToCart(userId);

        // If the wishlist is empty
        if (result.empty) {
            return res.redirect("/user/wishlist");
        }

        // Store result for the cart page
        req.session.moveAllResult = {
            addedCount: result.addedCount,
            unavailableItems: result.unavailableItems
        };

        return res.redirect("/user/cart");

    } catch (error) {
        console.error("Move wishlist to cart error:", error);
        return res.redirect("/user/wishlist");
    }
};


export default {
    toggleWishlist,
    loadWishlist,
    removeWishlist,
    moveAllToCart
};