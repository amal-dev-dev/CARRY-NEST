import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";
import Product from "../../Model/productModel.js";


const calculateTotalStock = (variants = []) => {
    return variants.reduce(
        (total, variant) => total + (Number(variant.stock) || 0),
        0
    );
};


const getProductsPageData = async ({
    search = "",
    page = 1,
    limit = 4
}) => {

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const skip = (currentPage - 1) * limit;

    const searchQuery = {
        productName: {
            $regex: search,
            $options: "i"
        }
    };

    // Fetch product data and counts
    const [
        products,
        totalProductsCount,
        totalProducts,
        allProducts
    ] = await Promise.all([

        Product.find(searchQuery)
            .populate("category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),

        Product.countDocuments(),

        Product.countDocuments(searchQuery),

        Product.find({}, { variants: 1 })
    ]);

    // Calculate stock for displayed products
    const productsWithStock = products.map(product => ({
        ...product.toObject(),
        totalStock: calculateTotalStock(product.variants)
    }));

    // Calculate stock statistics
    let lowStockCount = 0;
    let outOfStockCount = 0;

    allProducts.forEach(product => {

        const totalStock = calculateTotalStock(product.variants);

        if (totalStock === 0) {
            outOfStockCount++;
        } else if (totalStock < 10) {
            lowStockCount++;
        }

    });

    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products: productsWithStock,
        currentPage,
        totalPages,
        totalProductsCount,
        lowStockCount,
        outOfStockCount
    };
};



const validateProductName = (name) => {

    if (typeof name !== "string" || !name.trim()) {
        return "Product name is required.";
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 3 || trimmedName.length > 50) {
        return "Product name must be between 3 and 50 characters.";
    }

    if (!/[A-Za-z]/.test(trimmedName)) {
        return "Product name must contain at least one letter.";
    }

    if (!/^[A-Za-z0-9\s&'()-]+$/.test(trimmedName)) {
        return "Product name contains invalid characters.";
    }

    return null;
};



const getAddProductPageData = async () => {

    const [categories, brands] = await Promise.all([

        Category.find({
            isListed: true
        }),

        Brand.find({
            isActive: true
        })
            .sort({ name: 1 })
            .lean()

    ]);

    return {
        categories,
        brands
    };
};



const createProduct = async (body, files = []) => {

    // Validate brand
    const selectedBrand = await Brand.findOne({
        name: body.brand,
        isActive: true
    });

    if (!selectedBrand) {
        return {
            success: false,
            message: "Please select a valid active brand"
        };
    }

    // Validate product name
    const nameError = validateProductName(body.productName);

    if (nameError) {
        return {
            success: false,
            message: nameError
        };
    }

    // Validate description
    if (!body.description?.trim()) {
        return {
            success: false,
            message: "Description is required"
        };
    }

    // Normalize colors
    const colors = Array.isArray(body.colors)
        ? body.colors
        : body.colors
            ? [body.colors]
            : [];

    if (!colors.some(color => color?.trim())) {
        return {
            success: false,
            message: "At least one color is required"
        };
    }

    // Normalize variant fields
    const sizes = Array.isArray(body.sizes)
        ? body.sizes
        : body.sizes
            ? [body.sizes]
            : [];

    const stocks = Array.isArray(body.stocks)
        ? body.stocks
        : body.stocks !== undefined
            ? [body.stocks]
            : [];

    const regularPrices = Array.isArray(body.regularPrices)
        ? body.regularPrices
        : body.regularPrices !== undefined
            ? [body.regularPrices]
            : [];

    const salePrices = Array.isArray(body.salePrices)
        ? body.salePrices
        : body.salePrices !== undefined
            ? [body.salePrices]
            : [];

    // Keep only completely filled variants
    const variants = sizes
        .map((size, index) => ({
            size: (size || "").trim(),
            stock: stocks[index],
            regularPrice: regularPrices[index],
            salePrice: salePrices[index]
        }))
        .filter(variant => (
            variant.size !== "" &&
            String(variant.stock ?? "").trim() !== "" &&
            String(variant.regularPrice ?? "").trim() !== "" &&
            String(variant.salePrice ?? "").trim() !== ""
        ))
        .map(variant => ({
            size: variant.size,
            stock: Number(variant.stock),
            regularPrice: Number(variant.regularPrice),
            salePrice: Number(variant.salePrice)
        }));

    if (variants.length === 0) {
        return {
            success: false,
            message: "Please fill at least one complete product variant."
        };
    }

    // Validate variants
    for (const variant of variants) {

        if (
            !Number.isFinite(variant.stock) ||
            !Number.isFinite(variant.regularPrice) ||
            !Number.isFinite(variant.salePrice)
        ) {
            return {
                success: false,
                message: "Please enter valid stock and price values."
            };
        }

        if (
            variant.stock < 0 ||
            variant.regularPrice <= 0 ||
            variant.salePrice < 0
        ) {
            return {
                success: false,
                message: "Stock cannot be negative, original price must be positive, and sale price cannot be negative."
            };
        }

        if (variant.salePrice > variant.regularPrice) {
            return {
                success: false,
                message: "Sale price cannot be greater than original price."
            };
        }
    }

    // Validate uploaded images
    const images = files.map(file => file.path);

    if (images.length < 3) {
        return {
            success: false,
            message: "Please upload at least 3 product images"
        };
    }

    // Create product
    const newProduct = new Product({
        colors: colors.filter(color => color?.trim()),
        productName: body.productName.trim(),
        brand: selectedBrand.name,
        category: body.category,
        description: body.description.trim(),
        variants,
        productImage: images
    });

    await newProduct.save();

    return {
        success: true
    };
};

const updateProduct = async (id, body, files = []) => {

    const product = await Product.findById(id);

    if (!product) {
        return {
            success: false,
            notFound: true
        };
    }

    const {
        productName,
        description,
        category,
        brand,
        colors,
        removedImages
    } = body;

    // Validate product name
    const nameError = validateProductName(productName);

    if (nameError) {
        return {
            success: false,
            message: nameError
        };
    }

    // Validate selected brand
    const selectedBrand = await Brand.findOne({
        name: brand,
        isActive: true
    });

    if (!selectedBrand) {
        return {
            success: false,
            message: "Please select a valid active brand."
        };
    }

    // Normalize variant fields
    const sizes = Array.isArray(body.size)
        ? body.size
        : body.size
            ? [body.size]
            : [];

    const stocks = Array.isArray(body.stock)
        ? body.stock
        : body.stock !== undefined
            ? [body.stock]
            : [];

    const regularPrices = Array.isArray(body.regularPrice)
        ? body.regularPrice
        : body.regularPrice !== undefined
            ? [body.regularPrice]
            : [];

    const salePrices = Array.isArray(body.salePrice)
        ? body.salePrice
        : body.salePrice !== undefined
            ? [body.salePrice]
            : [];

    const variants = sizes
        .map((size, index) => ({
            size: String(size).trim(),
            stock: Number(stocks[index]),
            regularPrice: Number(regularPrices[index]),
            salePrice: Number(salePrices[index])
        }))
        .filter(variant => variant.size !== "");

    // Check whether variant fields were submitted
    const variantFieldsSubmitted =
        body.size !== undefined ||
        body.stock !== undefined ||
        body.regularPrice !== undefined ||
        body.salePrice !== undefined;

    if (variantFieldsSubmitted) {

        if (variants.length === 0) {
            return {
                success: false,
                message: "Please add at least one product variant."
            };
        }

        for (const variant of variants) {

            if (
                !Number.isFinite(variant.stock) ||
                !Number.isFinite(variant.regularPrice) ||
                !Number.isFinite(variant.salePrice)
            ) {
                return {
                    success: false,
                    message: "Please enter valid variant values."
                };
            }

            if (variant.stock < 0) {
                return {
                    success: false,
                    message: "Stock cannot be less than 0."
                };
            }

            if (
                variant.regularPrice <= 0 ||
                variant.salePrice < 0 ||
                variant.regularPrice <= variant.salePrice
            ) {
                return {
                    success: false,
                    message: "Regular price must be greater than sale price."
                };
            }
        }
    }

    // Handle existing images
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
    if (files.length > 0) {
        const newImages = files.map(file => file.path);
        updatedImages.push(...newImages);
    }

    // Update product fields
    product.productName = productName.trim();
    product.description = description;
    product.category = category;
    product.brand = selectedBrand.name;

    if (variantFieldsSubmitted) {
        product.variants = variants;
    }

    product.colors = Array.isArray(colors)
        ? colors
        : colors
            ? [colors]
            : [];

    product.productImage = updatedImages;

    await product.save();

    return {
        success: true
    };
};


const getEditProductPageData = async (id) => {
    const [product, categories, brands] = await Promise.all([
        Product.findById(id),
        Category.find({ isListed: true }),
        Brand.find({ isActive: true }).sort({ name: 1 }).lean()
    ]);

    return {
        product,
        categories,
        brands
    };
};

const toggleProductBlockStatus = async (id) => {

    const product = await Product.findById(id);

    if (!product) {
        return {
            success: false,
            notFound: true
        };
    }

    product.isBlocked = !product.isBlocked;

    await product.save();

    return {
        success: true,
        isBlocked: product.isBlocked
    };
};


const unblockProduct = async (id) => {

    const product = await Product.findByIdAndUpdate(
        id,
        { isBlocked: false },
        { returnDocument: "after" }
    );

    if (!product) {
        return {
            success: false,
            notFound: true
        };
    }

    return {
        success: true
    };
};



export default {
    getProductsPageData,
    getAddProductPageData,
    createProduct,
    getEditProductPageData,
    updateProduct,
    toggleProductBlockStatus,
    unblockProduct   
};
