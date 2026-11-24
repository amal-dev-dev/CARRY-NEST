const calculateItemRefund = (order, item) => {

    // Total value of all products in the order
    let orderSubtotal = 0;

    order.products.forEach(product => {
        const price = Number(product.price || 0);
        const quantity = Number(product.quantity || 0);

        orderSubtotal += price * quantity;
    });

    // Selected product total
    const itemTotal =
        Number(item.price || 0) *
        Number(item.quantity || 0);

    // Total coupon discount applied to order
    const couponDiscount =
        Number(order.discountApplied || 0);

    // Product's share of coupon discount
    let itemDiscount = 0;

    if (orderSubtotal > 0 && couponDiscount > 0) {
        itemDiscount =
            (itemTotal / orderSubtotal) *
            couponDiscount;
    }

    // Never allow discount greater than product price
    itemDiscount = Math.min(
        itemDiscount,
        itemTotal
    );

    itemDiscount = Number(
        itemDiscount.toFixed(2)
    );

    // Actual amount user paid for this product
    const refundAmount = Number(
        (itemTotal - itemDiscount).toFixed(2)
    );
    
    return {
        itemTotal,
        itemDiscount,
        refundAmount
    };
};

export default {
    calculateItemRefund
};