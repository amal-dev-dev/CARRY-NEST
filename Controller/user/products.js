import productService from "../../Service/user/productService.js";


const loadProducts = async (req, res) => {
    try {
        const {
            page = 1,
            search = "",
            category = "",
            brand = "",
            color = "",
            price = "",
            sort = "",
            message = ""
        } = req.query;

        const data = await productService.getProductsPageData({
            page,
            limit: 8,
            search,
            category,
            brand,
            color,
            price,
            sort,
            userId: req.session.user || null
        });

        return res.render("user/products", {
            ...data,
            message,
            search,
            category,
            brand,
            color,
            price,
            sort,
            user: req.session.user || null
        });

    } catch (error) {
        console.log("LOAD PRODUCTS ERROR:", error);
        return res.status(500).send("Unable to load products");
    }
};




const loadProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user || null;

        const data = await productService.getProductDetailsPageData(
            productId,
            userId
        );

        if (!data) {
            return res.redirect(
                "/user/products?message=Product%20is%20currently%20unavailable"
            );
        }

        return res.render("user/product-details", {
            ...data,
            user: userId
        });

    } catch (error) {
        console.log("PRODUCT DETAILS ERROR:", error);
        return res.redirect("/user/pageNotFound");
    }
};



export default {
    loadProducts,
    loadProductDetails
}