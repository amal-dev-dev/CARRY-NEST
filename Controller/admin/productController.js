import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";

const loadProducts = async (req, res) => {

    try {

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const searchQuery = {
            productName: {
                $regex: search,
                $options: "i"
            }
        };

        // Total products without search
        const totalProductsCount = await Product.countDocuments();

        // Get products
        const products = await Product.find(searchQuery)
            .populate("category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Calculate total stock for each product
        const productsWithStock = products.map(product => {

            const totalStock = product.variants.reduce(
                (total, variant) => {
                    return total + (Number(variant.stock) || 0);
                },
                0
            );

            return {
                ...product.toObject(),
                totalStock
            };

        });

        // Pagination
        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get all products for stock statistics
        const allProducts = await Product.find(
            searchQuery,
            { variants: 1 }
        );

        let lowStockCount = 0;
        let outOfStockCount = 0;

        allProducts.forEach(product => {

            const totalStock = product.variants.reduce(
                (total, variant) => {
                    return total + (Number(variant.stock) || 0);
                },
                0
            );

            if (totalStock === 0) {
                outOfStockCount++;
            }
            else if (totalStock > 0 && totalStock < 10) {
                lowStockCount++;
            }

        });

        const message = req.session.message;
        req.session.message = null;

        return res.render("admin/products", {

            products: productsWithStock,
            currentPage: page,
            totalPages,
            search,
            totalProductsCount,
            lowStockCount,
            outOfStockCount,
            message

        });

    } catch (error) {

        console.log("PRODUCT PAGE ERROR:", error);

        res.redirect("/admin/pageerror");

    }

};

const loadAddProduct = async(req,res)=>{

    try{

        const categories = await Category.find({
            isListed:true
        });  

        const brands = await Brand.find({
            isActive: true
        }).sort({ name: 1 }).lean();


        res.render("admin/add-product",{
            categories,
            brands,
            message: null
        });

    }catch(error){

        console.log("LOAD ADD PRODUCT ERROR:",error);

        res.redirect("/admin/pageerror");

    }

};



const addProduct = async (req, res) => {
    try {
        const categories = await Category.find({
            isListed: true
        });

        const brands = await Brand.find({
            isActive: true
        }).sort({ name: 1 }).lean();

        // Helper to render the form with all required data
        const renderAddProduct = (message) => {
            return res.status(400).render("admin/add-product", {
                categories,
                brands,
                message
            });
        };

        // Validate brand
        const selectedBrand = await Brand.findOne({
            name: req.body.brand,
            isActive: true
        });

        if (!selectedBrand) {
            return renderAddProduct(
                "Please select a valid active brand"
            );
        }

        // Validate product name
        if (!req.body.productName?.trim()) {
            return renderAddProduct("Product name is required");
        }

        // Validate description
        if (!req.body.description?.trim()) {
            return renderAddProduct("Description is required");
        }

        // Validate colors
        const colors = Array.isArray(req.body.colors)
            ? req.body.colors
            : req.body.colors
                ? [req.body.colors]
                : [];

        if (!colors.some(color => color?.trim())) {
            return renderAddProduct(
                "At least one color is required"
            );
        }

        // Safely handle variant fields
        const sizes = Array.isArray(req.body.sizes)
            ? req.body.sizes
            : req.body.sizes
                ? [req.body.sizes]
                : [];

        const stocks = Array.isArray(req.body.stocks)
            ? req.body.stocks
            : req.body.stocks !== undefined
                ? [req.body.stocks]
                : [];

        const regularPrices = Array.isArray(req.body.regularPrices)
            ? req.body.regularPrices
            : req.body.regularPrices !== undefined
                ? [req.body.regularPrices]
                : [];

        const salePrices = Array.isArray(req.body.salePrices)
            ? req.body.salePrices
            : req.body.salePrices !== undefined
                ? [req.body.salePrices]
                : [];

        let variants = sizes.map((size, index) => ({
            size: (size || "").trim(),
            stock: Number(stocks[index]),
            regularPrice: Number(regularPrices[index]),
            salePrice: Number(salePrices[index])
        }));

        // Remove empty variants
        variants = variants.filter(variant => variant.size !== "");

        if (variants.length === 0) {
            return renderAddProduct(
                "At least one product size is required"
            );
        }

        // Validate variant values
        for (const variant of variants) {
            if (
                !Number.isFinite(variant.stock) ||
                !Number.isFinite(variant.regularPrice) ||
                !Number.isFinite(variant.salePrice)
            ) {
                return renderAddProduct(
                    "Please enter valid stock and price values"
                );
            }

            if (
                variant.stock < 0 ||
                variant.regularPrice <= 0 ||
                variant.salePrice < 0
            ) {
                return renderAddProduct(
                    "Stock cannot be negative, original price must be positive, and sale price cannot be negative"
                );
            }

            if (variant.salePrice > variant.regularPrice) {
                return renderAddProduct(
                    "Sale price cannot be greater than original price"
                );
            }
        }

        // Upload images already handled by your upload middleware
        const images = req.files
            ? req.files.map(file => file.path)
            : [];

        if (images.length < 3) {
            return renderAddProduct(
                "Please upload at least 3 product images"
            );
        }

        // Create product
        const newProduct = new Product({
            colors: colors.filter(color => color?.trim()),
            productName: req.body.productName.trim(),
            brand: selectedBrand.name,
            category: req.body.category,
            description: req.body.description.trim(),
            variants,
            offer: req.body.offer,
            productImage: images
        });

        await newProduct.save();

        return res.redirect("/admin/products");

    } catch (error) {
        console.error("ADD PRODUCT ERROR:", error);

        return res.redirect("/admin/add-product");
    }
};



const loadEditProduct = async(req,res)=>{

    try{

        const id = req.params.id;

        const product = await Product.findById(id);

        const categories = await Category.find({

            isListed:true

        });

        const brands = await Brand.find({
            isActive: true
        }).sort({ name: 1 }).lean();

        res.render("admin/edit-product",{

            product,
            categories,
            brands

        });

    }catch(error){

        console.log("LOAD EDIT PRODUCT ERROR:",error);

        res.redirect("/admin/pageerror");

    }

};



const editProduct = async (req, res) => {
    try {
        const id = req.params.id;

        const product = await Product.findById(id);

        if (!product) {
            return res.redirect("/admin/products");
        }

        const categories = await Category.find({
            isListed: true
        });

        // Get active brands from MongoDB
        const brands = await Brand.find({
            isActive: true
        }).sort({ name: 1 }).lean();

        // Keep the current brand visible if it is now inactive
        const currentBrandExists = brands.some(
            brand => brand.name === product.brand
        );

        if (product.brand && !currentBrandExists) {
            brands.unshift({
                name: product.brand,
                isActive: false
            });
        }

        const {
            productName,
            offer,
            description,
            category,
            brand,
            colors,
            removedImages
        } = req.body;

        // Validate the selected brand
        const selectedBrand = await Brand.findOne({
            name: brand,
            isActive: true
        });

        if (!selectedBrand) {
            return res.status(400).render("admin/edit-product", {
                product,
                categories,
                brands,
                message: "Please select a valid active brand."
            });
        }

        // Normalize variant fields because a single input may arrive as a string
        const sizes = Array.isArray(req.body.size)
            ? req.body.size
            : req.body.size
                ? [req.body.size]
                : [];

        const stocks = Array.isArray(req.body.stock)
            ? req.body.stock
            : req.body.stock !== undefined
                ? [req.body.stock]
                : [];

        const regularPrices = Array.isArray(req.body.regularPrice)
            ? req.body.regularPrice
            : req.body.regularPrice !== undefined
                ? [req.body.regularPrice]
                : [];

        const salePrices = Array.isArray(req.body.salePrice)
            ? req.body.salePrice
            : req.body.salePrice !== undefined
                ? [req.body.salePrice]
                : [];

        let variants = sizes
            .map((size, index) => ({
                size: String(size).trim(),
                stock: Number(stocks[index]),
                regularPrice: Number(regularPrices[index]),
                salePrice: Number(salePrices[index])
            }))
            .filter(variant => variant.size !== "");

        // Validate variants
        if (variants.length === 0) {
            return res.status(400).render("admin/edit-product", {
                product,
                categories,
                brands,
                message: "Please add at least one product variant."
            });
        }

        for (const variant of variants) {
            if (
                !Number.isFinite(variant.stock) ||
                !Number.isFinite(variant.regularPrice) ||
                !Number.isFinite(variant.salePrice)
            ) {
                return res.status(400).render("admin/edit-product", {
                    product,
                    categories,
                    brands,
                    message: "Please enter valid variant values."
                });
            }

            if (variant.stock < 0) {
                return res.status(400).render("admin/edit-product", {
                    product,
                    categories,
                    brands,
                    message: "Stock cannot be less than 0."
                });
            }

            if (
                variant.regularPrice <= 0 ||
                variant.salePrice < 0 ||
                variant.regularPrice <= variant.salePrice
            ) {
                return res.status(400).render("admin/edit-product", {
                    product,
                    categories,
                    brands,
                    message: "Regular price must be greater than sale price."
                });
            }
        }

        // Existing images
        let updatedImages = [...product.productImage];

        // Remove selected images
        if (removedImages) {
            const removedIndexes = removedImages
                .split(",")
                .map(Number);

            updatedImages = updatedImages.filter(
                (_, index) => !removedIndexes.includes(index)
            );
        }

        // Add newly uploaded images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path);
            updatedImages.push(...newImages);
        }

        // Update product
        product.productName = productName;
        product.offer = offer;
        product.description = description;
        product.category = category;
        product.brand = selectedBrand.name;
        product.variants = variants;
        product.colors = Array.isArray(colors)
            ? colors
            : colors
                ? [colors]
                : [];
        product.productImage = updatedImages;

        await product.save();

        return res.redirect("/admin/products");

    } catch (error) {
        console.log("EDIT PRODUCT ERROR:", error);
        return res.redirect("/admin/pageerror");
    }
};


const blockProduct = async (req, res) => {

    try {

        const id = req.params.id;

        const product = await Product.findById(id);

        await Product.findByIdAndUpdate(id, {
            isBlocked: !product.isBlocked
        });

        req.session.message = !product.isBlocked
            ? "Product blocked successfully."
            : "Product unblocked successfully.";

        res.redirect("/admin/products");

    } catch (error) {

        console.log("BLOCK PRODUCT ERROR:", error);

        res.redirect("/admin/pageerror");

    }

};

const unblockProduct = async (req,res)=>{

    try{

        await Product.findByIdAndUpdate(
            req.params.id,
            { isBlocked:false }
        );

        req.session.message = "Product unblocked successfully.";

        res.redirect("/admin/products");

    }catch(error){

        console.log(error);

        res.redirect("/admin/pageerror");

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