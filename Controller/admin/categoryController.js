import Category from "../../Model/categoryModel.js";

const loadCategory = async (req, res) => {

    try {

        let search = req.query.search || "";

        let sort = req.query.sort || "desc";

        let page = parseInt(req.query.page) || 1;

        let limit = 5;

        let skip = (page - 1) * limit;

        let query = {};

        if(search){

            query.name = {
                $regex: search,
                $options: "i"
            };

        }

        let sortOption = {};

        if(sort === "desc"){

            sortOption.name = -1;

        }else{

            sortOption.name = 1;

        }

        const totalCategories = await Category.countDocuments(query);

        const totalPages = Math.ceil(totalCategories / limit);

        const categories = await Category.find(query)

        .sort(sortOption)

        .skip(skip)

        .limit(limit);

        res.render("admin/category", {

            categories,
            search,
            sort,
            currentPage: page,
            totalPages

        });

    } catch (error) {

        console.log(error);

    }

};

const loadAddCategory = async (req, res) => {

    try {
        res.render("admin/add-category");

    } catch (error) {
        console.log(error);
    }

};

const addCategory = async (req, res) => {

    try {

        const { name, description } = req.body;
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
            category
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


        res.redirect("/admin/categort");

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