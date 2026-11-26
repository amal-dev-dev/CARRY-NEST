import productService from "../../Service/admin/productService.js";


const loadProducts = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = req.query.page || 1;

        const data = await productService.getProductsPageData({
            search,
            page,
            limit: 4
        });

        const message = req.session.message;
        req.session.message = null;

        return res.render("admin/products", {
            ...data,
            search,
            message
        });

    } catch (error) {

        console.log("PRODUCT PAGE ERROR:", error);

        return res.redirect("/admin/pageerror");
    }
};



const loadAddProduct = async (req, res) => {

    try {

        const data = await productService.getAddProductPageData();

        return res.render("admin/add-product", {
            ...data,
            message: null,
            formData: {}
        });

    } catch (error) {

        console.log("LOAD ADD PRODUCT ERROR:", error);

        return res.redirect("/admin/pageerror");

    }

};



const addProduct = async (req, res) => {

    try {

        const result = await productService.createProduct(
            req.body,
            req.files || []
        );

        if (!result.success) {

            const data = await productService.getAddProductPageData();

            return res.status(400).render("admin/add-product", {
                ...data,
                message: result.message,
                formData: req.body
            });
        }

        return res.redirect("/admin/products");

    } catch (error) {

        console.error("ADD PRODUCT ERROR:", error);

        return res.redirect("/admin/add-product");

    }
};



const loadEditProduct = async (req, res) => {
    try {
        const id = req.params.id;

        const data = await productService.getEditProductPageData(id);

        if (!data.product) {
            return res.redirect("/admin/products");
        }

        return res.render("admin/edit-product", {
            ...data
        });

    } catch (error) {
        console.log("LOAD EDIT PRODUCT ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};



const editProduct = async (req, res) => {
    try {

        const id = req.params.id;

        const result = await productService.updateProduct(
            id,
            req.body,
            req.files || []
        );

        if (result.notFound) {
            return res.redirect("/admin/products");
        }

        if (!result.success) {

            const data = await productService.getEditProductPageData(id);

            return res.status(400).render("admin/edit-product", {
                ...data,
                message: result.message
            });
        }

        return res.redirect("/admin/products");

    } catch (error) {

        console.log("EDIT PRODUCT ERROR:", error);

        req.session.message = "Unable to update product. Please try again.";

        return res.redirect("/admin/products");
    }
};


const blockProduct = async (req, res) => {
    try {

        const result = await productService.toggleProductBlockStatus(
            req.params.id
        );

        if (result.notFound) {
            req.session.message = "Product not found.";
            return res.redirect("/admin/products");
        }

        req.session.message = result.isBlocked
            ? "Product blocked successfully."
            : "Product unblocked successfully.";

        return res.redirect("/admin/products");

    } catch (error) {

        console.log("BLOCK PRODUCT ERROR:", error);

        return res.redirect("/admin/pageerror");
    }
};


const unblockProduct = async (req, res) => {
    try {

        const result = await productService.unblockProduct(req.params.id);

        if (result.notFound) {
            req.session.message = "Product not found.";
            return res.redirect("/admin/products");
        }

        req.session.message = "Product unblocked successfully.";

        return res.redirect("/admin/products");

    } catch (error) {

        console.log("UNBLOCK PRODUCT ERROR:", error);

        return res.redirect("/admin/pageerror");
    }
};



export default {

    loadProducts,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    editProduct,
    blockProduct,
    unblockProduct

};