import Product from "../../Model/productModel.js";
import Offer from "../../Model/offerModel.js";
import Order from "../../Model/orderModel.js";
import Review from "../../Model/reviewModel.js";

const getHomeData = async () => {
    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const [products, activeOffers, salesData] = await Promise.all([

        Product.find({ isBlocked: false })
            .populate("category", "name")
            .limit(4)
            .lean(),

        Offer.find({
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: today }
        })
            .populate("productId", "productName")
            .populate("categoryId", "name")
            .sort({ createdAt: -1 })
            .lean(),

        Order.aggregate([
            {
                $match: {
                    $or: [
                        { paymentStatus: "completed" },
                        {
                            paymentMethod: "COD",
                            orderStatus: "delivered"
                        }
                    ],
                    orderStatus: {
                        $nin: ["payment_failed", "cancelled"]
                    }
                }
            },
            { $unwind: "$products" },
            {
                $match: {
                    "products.status": {
                        $nin: [
                            "cancelled",
                            "returned",
                            "return_requested",
                            "partially_returned"
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$products.productId",
                    totalSold: {
                        $sum: "$products.quantity"
                    }
                }
            },
            { $sort: { totalSold: -1 } }
        ])
    ]);

    // Apply the best active offer.
    const applyOffers = (product) => {
        const basePrice = Number(
            product.variants?.[0]?.salePrice ??
            product.variants?.[0]?.regularPrice ??
            0
        );

        const applicableOffers = activeOffers.filter((offer) => {
            if (offer.offerType === "product") {
                return String(offer.productId?._id) ===
                    String(product._id);
            }

            if (offer.offerType === "category") {
                return String(offer.categoryId?._id) ===
                    String(product.category?._id);
            }

            return false;
        });

        const bestOffer = applicableOffers.reduce(
            (best, current) => {
                if (
                    !best ||
                    current.discountPercentage > best.discountPercentage
                ) {
                    return current;
                }

                return best;
            },
            null
        );

        const offerPrice = bestOffer
            ? Math.round(
                basePrice *
                (1 - bestOffer.discountPercentage / 100)
            )
            : basePrice;

        return {
            ...product,
            basePrice,
            offerPrice,
            appliedOffer: bestOffer
        };
    };

    const productsWithOffers = products.map(applyOffers);

    // Get best-selling products.
    const soldProductIds = salesData.map(item => item._id);

    let topSellingProducts = [];

    if (soldProductIds.length > 0) {
        const soldProducts = await Product.find({
            _id: { $in: soldProductIds },
            isBlocked: false
        })
            .populate("category", "name")
            .lean();

        const productMap = new Map(
            soldProducts.map(product => [
                String(product._id),
                product
            ])
        );

        topSellingProducts = salesData
            .map(item => productMap.get(String(item._id)))
            .filter(Boolean)
            .slice(0, 4)
            .map(applyOffers);
    }

    const homepageOffers = activeOffers.filter(
        offer => offer.showOnHomepage
    );

    const brands = await Product.distinct("brand", {
        isBlocked: false
    });

    const recentReviews = await Review.find({
        rating: { $gte: 1, $lte: 5 },
        comment: { $exists: true, $ne: "" }
    })
        .populate("userId", "name")
        .populate("productId", "productName")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

    return {
        products: productsWithOffers,
        topSellingProducts,
        homepageOffers,
        brands,
        recentReviews
    };
};

export default {
    getHomeData
};
