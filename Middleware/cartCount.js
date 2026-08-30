import Cart from "../Model/cartModel.js";

export const cartCount = async (req, res, next) => {
    try {
        res.locals.cartCount = 0;

        if (req.session.user) {
            const cart = await Cart.findOne({ userId: req.session.user });

            if (cart && cart.items) {
                res.locals.cartCount = cart.items.reduce((total, item) => {
                    return total + item.quantity;
                }, 0);
            }
        }

        next();
    } catch (error) {
        console.log("Cart count middleware error:", error);
        res.locals.cartCount = 0;
        next();
    }
};