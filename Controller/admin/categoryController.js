import Category from "../../Model/categoryModel.js";
import Product from "../../Model/productModel.js";


const loadCategory = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const sort = req.query.sort === "asc" ? "asc" : "desc";

        const limit = 5;

        let page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const query = {};

        if (search) {
            // Escape special regex characters in the search input.
            const escapedSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            query.name = {
                $regex: escapedSearch,
                $options: "i"
            };
        }

        const sortOption = {
            name: sort === "asc" ? 1 : -1,
            _id: 1
        };

        const totalCategories = await Category.countDocuments(query);

        const totalPages = Math.max(
            1,
            Math.ceil(totalCategories / limit)
        );

        // Prevent requesting a page beyond the available pages.
        page = Math.min(page, totalPages);

        const skip = (page - 1) * limit;

        const categoryDocs = await Category.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        // Calculate actual product counts for the displayed categories.
        const categories = await Promise.all(
            categoryDocs.map(async (category) => {
                const productCount = await Product.countDocuments({
                    category: category._id
                });

                return {
                    ...category,
                    productCount
                };
            })
        );

        return res.render("admin/category", {
            categories,
            search,
            sort,
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error("Error loading categories:", error);
        return res.redirect("/admin/pageerror");
    }
};

const loadAddCategory = async (req, res) => {

    try {
        res.render("admin/add-category",{
            message:null
        });

    } catch (error) {
        console.log(error);
    }

};

const addCategory = async (req, res) => {

    try {

        const { name, description } = req.body;

        if (!name || name.trim() === "") {
            return res.render("admin/add-category", { message: "Category name required" });
        }


        if (name.length < 2 || name.length > 30) {
            return res.status(400).render("admin/category", {
                error: "Category name must be between 2 and 30 characters."
            });
        }

        if (!/[a-zA-Z0-9]/.test(name)) {
            return res.status(400).render("admin/add-category", {
                message: "Category name must contain at least one letter or number."
            });
        }

        if (!/^[a-zA-Z0-9 -]+$/.test(name)) {
            return res.status(400).render("admin/add-category", {
                message: "Only letters, numbers, spaces, and hyphens are allowed."
            });
        }

        // CHECK DUPLICATE
        const existingCategory = await Category.findOne({
            name: {
                $regex: new RegExp("^" + name + "$", "i")
            }
        });

        if (existingCategory) {
            return res.render("admin/add-category", { message: "Category already exists"});
        }


        // CREATE CATEGORY
        const newCategory = new Category({
            name,
            description
        });


        await newCategory.save();
        res.redirect("/admin/category");

    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");

    }
};

const loadEditCategory = async (req, res) => {

    try {

        const id = req.params.id;
        const category = await Category.findById(id);

        if (!category) {
            return res.redirect("/admin/categories");
        }


        res.render("admin/edit-category", {
            category,
            message: null
        });

    } catch (error) {
        console.log(error);
    }
};

const editCategory = async (req, res) => {

    try {

        const id = req.params.id;
        const { name, description } = req.body;

        const existingCategory = await Category.findOne({
            _id: { $ne: id },
            name: {
                $regex: new RegExp("^" + name + "$", "i")
            }
        });


        if (existingCategory) {

            return res.render("admin/edit-category", {
                category: await Category.findById(id),
                message: "Category already exists"

            });

        }


        await Category.findByIdAndUpdate(id, {
            name,
            description

        });


        res.redirect("/admin/category");

    } catch (error) {
        console.log(error);
    }
};

const unlistCategory = async (req, res) => {

    try {

        const id = req.params.id;

        await Category.findByIdAndUpdate(id, {
            isListed: false
        });

        res.redirect("/admin/category");

    } catch (error) {
        console.log(error);
    }
};

const listCategory = async (req, res) => {

    try {

        const id = req.params.id;

        await Category.findByIdAndUpdate(id, {
            isListed: true
        });


        res.redirect("/admin/category");

    } catch (error) {
        console.log(error);
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