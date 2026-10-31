
import Offer from "../../Model/offerModel.js";
import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";


const loadOffers = async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("productId", "productName")
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/coupons", {
      offers,
      error: null,
      success: null
    });
  } catch (error) {
    console.error("Load offers error:", error);
    res.status(500).send("Unable to load offers.");
  }
};


const loadAddOffer = async (req, res) => {
    try {
        const [products, categories] = await Promise.all([
            Product.find({ isBlocked: { $ne: true } })
                .select("_id productName")
                .sort({ productName: 1 })
                .lean(),

            Category.find({ isListed: true })
                .select("_id name")
                .sort({ name: 1 })
                .lean()
        ]);

        // Get category ID from the URL
        const categoryId = req.query.categoryId || "";

        // Find the selected category
        const selectedCategory = categories.find(
            category => category._id.toString() === categoryId
        );

        // Prepare form data
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

        return res.render("admin/add-offer", {
            products,
            categories,
            error: null,
            formData
        });

    } catch (error) {
        console.error("Load add offer error:", error);
        return res.status(500).send(
            "Unable to load the add offer page."
        );
    }
};

const addOffer = async (req, res) => {

  try {
    const {
      title,
      offerType,
      productId,
      categoryId,
      discountPercentage,
      validFrom,
      validTo
    } = req.body;

    const formData = {
      title: title?.trim() || "",
      offerType,
      productId: productId || "",
      categoryId: categoryId || "",
      discountPercentage,
      validFrom,
      validTo,
      isActive: req.body.isActive === "on",
      showOnHomepage: req.body.showOnHomepage === "on"
    };

    const [products, categories] = await Promise.all([
      Product.find({ isBlocked: { $ne: true } })
        .select("_id productName")
        .sort({ productName: 1 })
        .lean(),

      Category.find({ isListed: true })
        .select("_id name")
        .sort({ name: 1 })
        .lean()
    ]);

    const renderError = (message, status = 400) =>
      res.status(status).render("admin/add-offer", {
        products,
        categories,
        error: message,
        formData
      });

    if (!title?.trim()) {
      return renderError("Please enter an offer title.");
    }

    if (!["product", "category"].includes(offerType)) {
      return renderError("Please select a valid offer type.");
    }

    const percentage = Number(discountPercentage);

    if (
      !Number.isFinite(percentage) ||
      percentage < 1 ||
      percentage > 90
    ) {
      return renderError("Discount must be between 1% and 90%.");
    }

    if (!validFrom || !validTo) {
      return renderError("Please select both validity dates.");
    }

    const start = new Date(validFrom);
    const end = new Date(validTo);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return renderError("End date must be after the start date.");
    }

    const selectedId =
      offerType === "product" ? productId : categoryId;

    if (!selectedId || !/^[a-f\d]{24}$/i.test(selectedId)) {
      return renderError(
        `Please select a valid ${offerType}.`
      );
    }

    if (offerType === "product") {
      const product = await Product.findOne({
        _id: selectedId,
        isBlocked: { $ne: true }
      });

      if (!product) {
        return renderError("The selected product is unavailable.");
      }
    } else {
      const category = await Category.findOne({
        _id: selectedId,
        isListed: true
      });

      if (!category) {
        return renderError("The selected category is unavailable.");
      }
    }

    const offerData = {
      title: title.trim(),
      offerType,
      discountType: "percentage",
      discountPercentage: percentage,
      productId: offerType === "product" ? selectedId : null,
      categoryId: offerType === "category" ? selectedId : null,
      validFrom: start,
      validTo: end,
      isActive: req.body.isActive === "on",
      showOnHomepage: req.body.showOnHomepage === "on"
    };

    await Offer.create(offerData);

    return res.redirect("/admin/coupons");

  } catch (error) {
    console.error("Add offer error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).send(
        Object.values(error.errors)
          .map((item) => item.message)
          .join(", ")
      );
    }

    res.status(500).send("Unable to save offer.");
  }
};

export const loadEditOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const [offer, products, categories] = await Promise.all([
            Offer.findById(id)
                .populate("productId")
                .populate("categoryId"),

            Product.find({ isBlocked: false }),

            Category.find({})
        ]);

        if (!offer) {
            return res.redirect("/admin/coupons");
        }

        return res.render("admin/edit-offer", {
            offer,
            products,
            categories,
            error: null
        });

    } catch (error) {
        console.error("Error loading edit offer:", error);
        return res.redirect("/admin/coupons");
    }
};


const editOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            title,
            offerType,
            productId,
            categoryId,
            discountPercentage,
            validFrom,
            validTo
        } = req.body;

        const offer = await Offer.findById(id);

        if (!offer) {
            return res.redirect("/admin/coupons");
        }

        // Load data needed to render the edit page if validation fails
        const [products, categories] = await Promise.all([
            Product.find({ isBlocked: { $ne: true } })
                .select("_id productName")
                .sort({ productName: 1 })
                .lean(),

            Category.find({ isListed: true })
                .select("_id name")
                .sort({ name: 1 })
                .lean()
        ]);

        const formData = {
            title: title?.trim() || "",
            offerType,
            productId: productId || "",
            categoryId: categoryId || "",
            discountPercentage: discountPercentage || "",
            validFrom: validFrom || "",
            validTo: validTo || "",
            isActive: req.body.isActive === "on",
            showOnHomepage: req.body.showOnHomepage === "on"
        };

        const renderError = (message) => {
            return res.status(400).render("admin/edit-offer", {
                offer,
                products,
                categories,
                error: message,
                formData
            });
        };

        // Validate title
        if (!title?.trim()) {
            return renderError("Please enter an offer title.");
        }

        // Validate offer type
        if (!["product", "category"].includes(offerType)) {
            return renderError("Please select a valid offer type.");
        }

        // Validate discount percentage
        const percentage = Number(discountPercentage);

        if (
            !Number.isFinite(percentage) ||
            percentage < 1 ||
            percentage > 90
        ) {
            return renderError("Discount must be between 1% and 90%.");
        }

        // Validate dates
        if (!validFrom || !validTo) {
            return renderError("Please select both validity dates.");
        }

        const start = new Date(validFrom);
        const end = new Date(validTo);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            return renderError("End date must be after the start date.");
        }

        // Validate selected product or category
        const selectedId =
            offerType === "product" ? productId : categoryId;

        if (!selectedId || !/^[a-f\d]{24}$/i.test(selectedId)) {
            return renderError(`Please select a valid ${offerType}.`);
        }

        if (offerType === "product") {
            const product = await Product.findOne({
                _id: selectedId,
                isBlocked: { $ne: true }
            });

            if (!product) {
                return renderError("The selected product is unavailable.");
            }
        } else {
            const category = await Category.findOne({
                _id: selectedId,
                isListed: true
            });

            if (!category) {
                return renderError("The selected category is unavailable.");
            }
        }

        // Update the offer using your existing schema fields
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
        offer.isActive = req.body.isActive === "on";
        offer.showOnHomepage = req.body.showOnHomepage === "on";

        await offer.save();

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Error updating offer:", error);

        if (error.name === "ValidationError") {
            return res.status(400).send(
                Object.values(error.errors)
                    .map((item) => item.message)
                    .join(", ")
            );
        }

        return res.status(500).send("Unable to update offer.");
    }
};

const toggleOfferStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[a-f\d]{24}$/i.test(id)) {
            return res.redirect("/admin/coupons");
        }

        const offer = await Offer.findById(id);

        if (!offer) {
            return res.redirect("/admin/coupons");
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Toggle offer status error:", error);
        return res.redirect("/admin/coupons");
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[a-f\d]{24}$/i.test(id)) {
            return res.redirect("/admin/coupons");
        }

        const deletedOffer = await Offer.findByIdAndDelete(id);

        if (!deletedOffer) {
            return res.redirect("/admin/coupons");
        }

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.error("Delete offer error:", error);
        return res.redirect("/admin/coupons");
    }
};

export default {
    loadOffers,
    loadAddOffer,
    addOffer,
    loadEditOffer,
    editOffer,
    toggleOfferStatus,
    deleteOffer
}