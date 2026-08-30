import Wishlist from "../Model/wishlistModel.js";

export const wishlistCount = async (req, res, next) => {
    try {

        res.locals.wishlistCount = 0;

        if (req.session.user) {

            const wishlist = await Wishlist.findOne({
                userId: req.session.user
            });

            if (wishlist && wishlist.items) {
                res.locals.wishlistCount = wishlist.items.length;
            }
        }

        next();

    } catch (error) {

        console.log("Wishlist count middleware error:", error);

        res.locals.wishlistCount = 0;

        next();
    }
};