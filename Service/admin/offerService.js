
import Offer from "../../Model/offerModel.js";
import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";

const getAvailableProducts = async () => {
    return await Product.find({
        isBlocked: { $ne: true }
    })
        .select("_id productName")
        .sort({ productName: 1 })
        .lean();
};

const getAvailableCategories = async () => {
    return await Category.find({
        isListed: true
    })
        .select("_id name")
        .sort({ name: 1 })
        .lean();
};

// =========================================
// 1. LOAD OFFERS
// =========================================

const getAllOffers = async () => {
    return await Offer.find()
        .populate("productId", "productName")
        .populate("categoryId", "name")
        .sort({ createdAt: -1 })
        .lean();
};

// =========================================
// 2. LOAD ADD OFFER PAGE
// =========================================

const getAddOfferData = async (categoryId = "") => {
    const [products, categories] = await Promise.all([
        getAvailableProducts(),
        getAvailableCategories()
    ]);

    const selectedCategory = categories.find(
        category => category._id.toString() === categoryId
    );

    const formData = {
        title: selectedCategory
            ? `${selectedCategory.name} Offer`
            : "",
        offerType: selectedCategory ? "category" : "product",
        productId: "",
        categoryId: selectedCategory
            ? selectedCategory._id.toString()
            : "",
        discountPercentage: "",
        validFrom: "",
        validTo: "",
        isActive: true,
        showOnHomepage: false
    };

    return {
        products,
        categories,
        formData
    };
};

// =========================================
// 3. ADD OFFER
// =========================================

const createOffer = async (body) => {
    const {
        title,
        offerType,
        productId,
        categoryId,
        discountPercentage,
        validFrom,
        validTo
    } = body;

    const formData = {
        title: title?.trim() || "",
        offerType,
        productId: productId || "",
        categoryId: categoryId || "",
        discountPercentage: discountPercentage || "",
        validFrom: validFrom || "",
        validTo: validTo || "",
        isActive: body.isActive === "on",
        showOnHomepage: body.showOnHomepage === "on"
    };

    const [products, categories] = await Promise.all([
        getAvailableProducts(),
        getAvailableCategories()
    ]);

    const failure = (message) => ({
        success: false,
        message,
        products,
        categories,
        formData
    });

    if (!title?.trim()) {
        return failure("Please enter an offer title.");
    }

    if (!["product", "category"].includes(offerType)) {
        return failure("Please select a valid offer type.");
    }

    const percentage = Number(discountPercentage);

    if (
        !Number.isFinite(percentage) ||
        percentage < 1 ||
        percentage > 90
    ) {
        return failure("Discount must be between 1% and 90%.");
    }

    if (!validFrom || !validTo) {
        return failure("Please select both validity dates.");
    }

    const start = new Date(validFrom);
    const end = new Date(validTo);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        return failure("End date must be after the start date.");
    }

    const selectedId =
        offerType === "product" ? productId : categoryId;

    if (!selectedId || !/^[a-f\d]{24}$/i.test(selectedId)) {
        return failure(`Please select a valid ${offerType}.`);
    }

    if (offerType === "product") {
        const product = await Product.findOne({
            _id: selectedId,
            isBlocked: { $ne: true }
        });

        if (!product) {
            return failure("The selected product is unavailable.");
        }
    } else {
        const category = await Category.findOne({
            _id: selectedId,
            isListed: true
        });

        if (!category) {
            return failure("The selected category is unavailable.");
        }
    }

    await Offer.create({
        title: title.trim(),
        offerType,
        discountType: "percentage",
        discountPercentage: percentage,
        productId: offerType === "product" ? selectedId : null,
        categoryId: offerType === "category" ? selectedId : null,
        validFrom: start,
        validTo: end,
        isActive: body.isActive === "on",
        showOnHomepage: body.showOnHomepage === "on"
    });

    return {
        success: true
    };
};

// =========================================
// 4. LOAD EDIT OFFER PAGE
// =========================================

const getEditOfferData = async (id) => {
    const [offer, products, categories] = await Promise.all([
        Offer.findById(id)
            .populate("productId")
            .populate("categoryId"),

        getAvailableProducts(),

        Category.find({})
    ]);

    if (!offer) {
        return null;
    }

    return {
        offer,
        products,
        categories
    };
};

// =========================================
// 5. UPDATE OFFER
// =========================================

const updateOffer = async (id, body) => {
    const {
        title,
        offerType,
        productId,
        categoryId,
        discountPercentage,
        validFrom,
        validTo
    } = body;

    const offer = await Offer.findById(id);

    if (!offer) {
        return {
            success: false,
            notFound: true
        };
    }

    const [products, categories] = await Promise.all([
        getAvailableProducts(),
        getAvailableCategories()
    ]);

    const formData = {
        title: title?.trim() || "",
        offerType,
        productId: productId || "",
        categoryId: categoryId || "",
        discountPercentage: discountPercentage || "",
        validFrom: validFrom || "",
        validTo: validTo || "",
        isActive: body.isActive === "on",
        showOnHomepage: body.showOnHomepage === "on"
    };

    const failure = (message) => ({
        success: false,
        message,
        offer,
        products,
        categories,
        formData
    });

    if (!title?.trim()) {
        return failure("Please enter an offer title.");
    }

    if (!["product", "category"].includes(offerType)) {
        return failure("Please select a valid offer type.");
    }

    const percentage = Number(discountPercentage);

    if (
        !Number.isFinite(percentage) ||
        percentage < 1 ||
        percentage > 90
    ) {
        return failure("Discount must be between 1% and 90%.");
    }

    if (!validFrom || !validTo) {
        return failure("Please select both validity dates.");
    }

    const start = new Date(validFrom);
    const end = new Date(validTo);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        return failure("End date must be after the start date.");
    }

    const selectedId =
        offerType === "product" ? productId : categoryId;

    if (!selectedId || !/^[a-f\d]{24}$/i.test(selectedId)) {
        return failure(`Please select a valid ${offerType}.`);
    }

    if (offerType === "product") {
        const product = await Product.findOne({
            _id: selectedId,
            isBlocked: { $ne: true }
        });

        if (!product) {
            return failure("The selected product is unavailable.");
        }
    } else {
        const category = await Category.findOne({
            _id: selectedId,
            isListed: true
        });

        if (!category) {
            return failure("The selected category is unavailable.");
        }
    }

    if (percentage > 90) {
        return failure("Discount must be between 1% and 90%.");
    }

    offer.title = title.trim();
    offer.offerType = offerType;
    offer.discountType = "percentage";
    offer.discountPercentage = percentage;
    offer.productId =
        offerType === "product" ? selectedId : null;
    offer.categoryId =
        offerType === "category" ? selectedId : null;
    offer.validFrom = start;
    offer.validTo = end;
    offer.isActive = body.isActive === "on";
    offer.showOnHomepage = body.showOnHomepage === "on";

    await offer.save();

    return {
        success: true
    };
};

// =========================================
// 6. TOGGLE OFFER STATUS
// =========================================

const toggleOfferStatus = async (id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) {
        return {
            success: false
        };
    }

    const offer = await Offer.findById(id);

    if (!offer) {
        return {
            success: false
        };
    }

    offer.isActive = !offer.isActive;

    await offer.save();

    return {
        success: true
    };
};

// =========================================
// 7. DELETE OFFER
// =========================================

const deleteOffer = async (id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) {
        return {
            success: false
        };
    }

    const deletedOffer = await Offer.findByIdAndDelete(id);

    return {
        success: Boolean(deletedOffer)
    };
};

export default {
    getAllOffers,
    getAddOfferData,
    createOffer,
    getEditOfferData,
    updateOffer,
    toggleOfferStatus,
    deleteOffer
};
