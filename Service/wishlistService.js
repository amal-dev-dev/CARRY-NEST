import Wishlist from "../Model/wishlistModel.js";

const removeWishlistItem = async (
    userId,
    productId,
    variantId
) => {

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        return;
    }

    wishlist.items = wishlist.items.filter(item =>

        !(
            item.productId.toString() === productId.toString() &&
            item.variantId.toString() === variantId.toString()
        )

    );

    await wishlist.save();
};

export {
    removeWishlistItem
};