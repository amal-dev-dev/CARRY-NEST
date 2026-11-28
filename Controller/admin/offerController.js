
import offerService from "../../Service/admin/offerService.js";

// =========================================
// 1. LOAD OFFERS
// =========================================

const loadOffers = async (req, res) => {
    try {
        const offers = await offerService.getAllOffers();

        return res.render("admin/coupons", {
            offers,
            error: null,
            success: null
        });

    } catch (error) {
        console.error("Load offers error:", error);
        return res.status(500).send("Unable to load offers.");
    }
};

// =========================================
// 2. LOAD ADD OFFER PAGE
// =========================================

const loadAddOffer = async (req, res) => {
    try {
        const data = await offerService.getAddOfferData(
            req.query.categoryId || ""
        );

        return res.render("admin/add-offer", {
            ...data,
            error: null
        });

    } catch (error) {
        console.error("Load add offer error:", error);

        return res.status(500).send(
            "Unable to load the add offer page."
        );
    }
};

// =========================================
// 3. ADD OFFER
// =========================================

const addOffer = async (req, res) => {
    try {
        const result = await offerService.createOffer(req.body);

        if (!result.success) {
            return res.status(400).render("admin/add-offer", {
                products: result.products,
                categories: result.categories,
                error: result.message,
                formData: result.formData
            });
        }

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Add offer error:", error);

        if (error.name === "ValidationError") {
            return res.status(400).send(
                Object.values(error.errors)
                    .map(item => item.message)
                    .join(", ")
            );
        }

        return res.status(500).send("Unable to save offer.");
    }
};

// =========================================
// 4. LOAD EDIT OFFER PAGE
// =========================================

const loadEditOffer = async (req, res) => {
    try {
        const data = await offerService.getEditOfferData(
            req.params.id
        );

        if (!data) {
            return res.redirect("/admin/coupons");
        }

        return res.render("admin/edit-offer", {
            ...data,
            error: null
        });

    } catch (error) {
        console.error("Error loading edit offer:", error);
        return res.redirect("/admin/coupons");
    }
};

// =========================================
// 5. EDIT OFFER
// =========================================

const editOffer = async (req, res) => {
    try {
        const result = await offerService.updateOffer(
            req.params.id,
            req.body
        );

        if (result.notFound) {
            return res.redirect("/admin/coupons");
        }

        if (!result.success) {
            return res.status(400).render("admin/edit-offer", {
                offer: result.offer,
                products: result.products,
                categories: result.categories,
                error: result.message,
                formData: result.formData
            });
        }

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Error updating offer:", error);

        if (error.name === "ValidationError") {
            return res.status(400).send(
                Object.values(error.errors)
                    .map(item => item.message)
                    .join(", ")
            );
        }

        return res.status(500).send("Unable to update offer.");
    }
};

// =========================================
// 6. TOGGLE OFFER STATUS
// =========================================

const toggleOfferStatus = async (req, res) => {
    try {
        await offerService.toggleOfferStatus(req.params.id);

        return res.redirect("/admin/coupons");

    } catch (error) {
        console.error("Toggle offer status error:", error);
        return res.redirect("/admin/coupons");
    }
};

// =========================================
// 7. DELETE OFFER
// =========================================

const deleteOffer = async (req, res) => {
    try {
        await offerService.deleteOffer(req.params.id);

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
};
