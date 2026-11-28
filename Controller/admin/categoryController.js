
import categoryService from "../../Service/admin/categoryService.js";

// Load categories page
const loadCategory = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const sort = req.query.sort === "asc" ? "asc" : "desc";
        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const data = await categoryService.getCategoriesPageData({
            search,
            sort,
            page,
            limit: 5
        });

        return res.render("admin/category", {
            ...data,
            search,
            sort
        });

    } catch (error) {
        console.error("Error loading categories:", error);
        return res.redirect("/admin/pageerror");
    }
};

// Load add category page
const loadAddCategory = (req, res) => {
    return res.render("admin/add-category", {
        message: null
    });
};

// Add category
const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        const result = await categoryService.addCategory(
            name,
            description
        );

        if (!result.success) {
            return res.status(400).render("admin/add-category", {
                message: result.message
            });
        }

        return res.redirect("/admin/category");

    } catch (error) {
        console.error("ADD CATEGORY ERROR:", error);

        return res.status(500).render("admin/add-category", {
            message: "Unable to add category. Please try again."
        });
    }
};

// Load edit category page
const loadEditCategory = async (req, res) => {
    try {
        const category = await categoryService.getCategoryById(
            req.params.id
        );

        if (!category) {
            return res.redirect("/admin/category");
        }

        return res.render("admin/edit-category", {
            category,
            message: null
        });

    } catch (error) {
        console.error("LOAD EDIT CATEGORY ERROR:", error);
        return res.redirect("/admin/category");
    }
};

// Edit category
const editCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        const result = await categoryService.updateCategory(
            req.params.id,
            name,
            description
        );

        if (result.notFound) {
            return res.redirect("/admin/category");
        }

        if (!result.success) {
            return res.status(400).render("admin/edit-category", {
                category: result.category,
                message: result.message
            });
        }

        return res.redirect("/admin/category");

    } catch (error) {
        console.error("EDIT CATEGORY ERROR:", error);
        return res.redirect("/admin/category");
    }
};

// Unlist category
const unlistCategory = async (req, res) => {
    try {
        const category = await categoryService.updateCategoryListingStatus(
            req.params.id,
            false
        );

        if (!category) {
            return res.redirect("/admin/category");
        }

        return res.redirect("/admin/category");

    } catch (error) {
        console.error("UNLIST CATEGORY ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};

// List category
const listCategory = async (req, res) => {
    try {
        const category = await categoryService.updateCategoryListingStatus(
            req.params.id,
            true
        );

        if (!category) {
            return res.redirect("/admin/category");
        }

        return res.redirect("/admin/category");

    } catch (error) {
        console.error("LIST CATEGORY ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};

export default {
    loadCategory,
    loadAddCategory,
    addCategory,
    loadEditCategory,
    editCategory,
    unlistCategory,
    listCategory
};
