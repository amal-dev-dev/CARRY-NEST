import Product from "../Model/productModel.js";
import Cart from "../Model/cartModel.js";
import Offer from "../Model/offerModel.js";

const MAX_QTY_PER_ITEM = 5;


// GET CART


const getCart = async (userId) => {
    return await Cart.findOne({ userId })
        .populate({
            path: "items.productId",
            populate: {
                path: "category",
                model: "Category"
            }
        });
};


// ADD ITEM TO CART

const addItemToCart = async (
    userId,
    variantId,
    requestedQuantity = 1
) => {

    // Find product using variant ID
    const product = await Product.findOne({
        "variants._id": variantId
    });

    // Product not found or blocked
    if (!product || product.isBlocked) {
        throw new Error("Product unavailable");
    }


    // Find selected variant
    const variant = product.variants.id(variantId);

    if (!variant) {
        throw new Error("Variant not found");
    }


    // Check stock
    if (variant.stock <= 0) {
        throw new Error("Product is out of stock");
    }


    // Get user's cart
    let cart = await Cart.findOne({ userId });


    // CREATE NEW CART

    if (!cart) {

        const quantity = Math.min(
            Number(requestedQuantity) || 1,
            MAX_QTY_PER_ITEM,
            variant.stock
        );


        cart = new Cart({

            userId,

            items: [
                {
                    productId: product._id,
                    variantId: variantId,
                    quantity: quantity
                }
            ]

        });

    }

    // EXISTING CART

    else {

        const existingItem = cart.items.find(
            (item) =>
                item.variantId.toString() ===
                variantId.toString()
        );


        // ITEM ALREADY EXISTS

        if (existingItem) {

            if (existingItem.quantity >= MAX_QTY_PER_ITEM) {
                throw new Error(
                    `Maximum ${MAX_QTY_PER_ITEM} quantity allowed`
                );
            }


            if (existingItem.quantity >= variant.stock) {
                throw new Error("Not enough stock available");
            }


            existingItem.quantity += 1;

        }

        // NEW ITEM

        else {

            const quantity = Math.min(
                Number(requestedQuantity) || 1,
                MAX_QTY_PER_ITEM,
                variant.stock
            );


            cart.items.push({

                productId: product._id,

                variantId: variantId,

                quantity: quantity

            });

        }
    }


    await cart.save();

    return cart;
};


// INCREASE CART ITEM

const increaseCartItem = async (
    userId,
    variantId
) => {


    // Find cart
    const cart = await Cart.findOne({ userId });

    if (!cart) {
        throw new Error("Cart not found");
    }


    // Find cart item
    const item = cart.items.find(
        (item) =>
            item.variantId &&
            item.variantId.toString() === variantId.toString()
    );


    if (!item) {
        throw new Error("Cart item not found");
    }


    // Find product
    const product = await Product.findOne({
        "variants._id": variantId
    });


    if (!product || product.isBlocked) {
        throw new Error("Product unavailable");
    }


    // Find variant
    const variant = product.variants.id(variantId);


    if (!variant) {
        throw new Error("Variant not found");
    }


    // Maximum quantity check
    if (item.quantity >= MAX_QTY_PER_ITEM) {

        throw new Error(
            `Maximum ${MAX_QTY_PER_ITEM} quantity allowed`
        );
    }


    // Stock check
    if (item.quantity >= variant.stock) {

        throw new Error(
            "Not enough stock available"
        );
    }


    // Increase quantity
    item.quantity += 1;


    await cart.save();


    // Return updated populated cart
    return await getCart(userId);
};


// DECREASE CART ITEM

const decreaseCartItem = async (userId, variantId) => {

    const cart = await Cart.findOne({ userId });


    if (!cart) {
        throw new Error("Cart not found");
    }


    // Find item
    const item = cart.items.find(
        (item) =>
            item.variantId &&
            item.variantId.toString() === variantId.toString()
    );


    if (!item) {
        throw new Error("Cart item not found");
    }


    let removed = false;


    // If quantity is 1, remove item
    if (item.quantity === 1) {

        cart.items = cart.items.filter(
            (cartItem) =>
                cartItem.variantId.toString() !==
                variantId.toString()
        );

        removed = true;

    }

    // Otherwise decrease quantity
    else {

        item.quantity -= 1;
    }


    await cart.save();


    const updatedCart = await getCart(userId);


    return {
        cart: updatedCart,
        removed
    };
};


// REMOVE CART ITEM

const removeCartItemService = async (
    userId,
    variantId
) => {

    const cart = await Cart.findOne({ userId });

    if (!cart) {
        throw new Error("Cart not found");
    }

    const item = cart.items.find(
        (item) =>
            item.variantId &&
            item.variantId.toString() ===
            variantId.toString()
    );

    // Check whether item exists
    if (!item) {
        throw new Error("Cart item not found");
    }

    // Remove item
    cart.items = cart.items.filter(
        (item) =>
            item.variantId &&
            item.variantId.toString() !==
            variantId.toString()
    );

    await cart.save();

    // Return updated cart
    return await getCart(userId);
};


// BUILD CART ITEMS

const buildCartItems = (cart) => {

    if (!cart) {
        return [];
    }


    return cart.items
        .map((item) => {

            const product = item.productId;


            // Product deleted
            if (!product) {
                return null;
            }


            // Find variant
            const variant = product.variants.find(
                (v) =>
                    v._id.toString() ===
                    item.variantId.toString()
            );


            // Variant deleted
            if (!variant) {
                return null;
            }


            return {

                ...item.toObject(),

                productId: product,

                variant: variant

            };

        })

        .filter(Boolean);
};


// CALCULATE CART TOTALS


const calculateCartTotals = async (cartItems) => {
    const offers = await Offer.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: {
            $gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate()
            )
        }
    })
        .populate("productId", "_id")
        .populate("categoryId", "_id")
        .lean();

    let subtotal = 0;
    let productDiscount = 0;
    let offerDiscount = 0;

    const itemPricing = {};

    for (const item of cartItems) {
        if (!item.productId || !item.variant) continue;

        const product = item.productId;
        const variant = item.variant;
        const quantity = Number(item.quantity) || 0;

        if (product.isBlocked) continue;

        const regularPrice = Number(variant.regularPrice) || 0;
        const salePrice = Number(
            variant.salePrice ?? variant.regularPrice ?? 0
        );

        // Discount from regular price to sale price
        const unitProductDiscount = Math.max(
            regularPrice - salePrice,
            0
        );

        // Find applicable product/category offers
        const applicableOffers = offers.filter(offer => {
            if (offer.offerType === "product") {
                return String(offer.productId?._id) ===
                    String(product._id);
            }

            if (offer.offerType === "category") {
                const categoryId =
                    product.category?._id ?? product.category;

                return String(offer.categoryId?._id) ===
                    String(categoryId);
            }

            return false;
        });

        // Apply the highest percentage offer
        const bestOffer = applicableOffers.reduce(
            (best, current) => {
                if (
                    !best ||
                    current.discountPercentage >
                        best.discountPercentage
                ) {
                    return current;
                }

                return best;
            },
            null
        );

        const offerPercentage =
            Number(bestOffer?.discountPercentage) || 0;

        const finalUnitPrice = Math.round(
            salePrice * (1 - offerPercentage / 100) * 100
        ) / 100;

        const unitOfferDiscount = Math.max(
            salePrice - finalUnitPrice,
            0
        );

        const itemSubtotal = regularPrice * quantity;
        const itemProductDiscount =
            unitProductDiscount * quantity;
        const itemOfferDiscount =
            unitOfferDiscount * quantity;

        const itemTotal = finalUnitPrice * quantity;

        subtotal += itemSubtotal;
        productDiscount += itemProductDiscount;
        offerDiscount += itemOfferDiscount;

        itemPricing[String(item.variantId)] = {
            regularPrice,
            basePrice: salePrice,
            unitPrice: finalUnitPrice,
            quantity,
            originalItemTotal: itemSubtotal,
            productDiscount: itemProductDiscount,
            offerDiscount: itemOfferDiscount,
            itemDiscount:
                itemProductDiscount + itemOfferDiscount,
            itemTotal,
            offerDiscountPercentage: offerPercentage,
            offerTitle: bestOffer?.title || ""
        };
    }

    subtotal = Number(subtotal.toFixed(2));
    productDiscount = Number(productDiscount.toFixed(2));
    offerDiscount = Number(offerDiscount.toFixed(2));

    const discount = Number(
        (productDiscount + offerDiscount).toFixed(2)
    );

    const deliveryFee = 0;

    const grandTotal = Math.max(
        Number((subtotal - discount + deliveryFee).toFixed(2)),
        0
    );

    return {
        subtotal,
        productDiscount,
        offerDiscount,
        discount,
        deliveryFee,
        grandTotal,
        itemPricing
    };
};



// CALCULATE CART COUNT

const calculateCartCount = (items = []) => {
    return items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );
};


export {
    getCart,
    addItemToCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItemService,
    buildCartItems,
    calculateCartTotals,
    calculateCartCount
};