
import Category from "../../Model/categoryModel.js";
import Product from "../../Model/productModel.js";

// Escape special regex characters
const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Validate category name
const validateCategoryName = (name) => {
    const categoryName =
        typeof name === "string" ? name.trim() : "";

    if (!categoryName) {
        return "Category name is required.";
    }

    if (categoryName.length < 2 || categoryName.length > 30) {
        return "Category name must be between 2 and 30 characters.";
    }

    if (!/[a-zA-Z]/.test(categoryName)) {
        return "Category name must contain at least one letter.";
    }

    if (!/^[a-zA-Z0-9 -]+$/.test(categoryName)) {
        return "Only letters, numbers, spaces, and hyphens are allowed.";
    }

    return null;
};

// Get categories with search, sorting and pagination
const getCategoriesPageData = async ({
    search = "",
    sort = "desc",
    page = 1,
    limit = 5
}) => {
    const query = {};

    if (search) {
        query.name = {
            $regex: escapeRegex(search),
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

    const currentPage = Math.min(
        Math.max(1, page),
        totalPages
    );

    const skip = (currentPage - 1) * limit;

    const categoryDocs = await Category.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

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

    return {
        categories,
        currentPage,
        totalPages
    };
};

// Add category
const addCategory = async (name, description) => {
    const categoryName =
        typeof name === "string" ? name.trim() : "";

    const validationError = validateCategoryName(categoryName);

    if (validationError) {
        return {
            success: false,
            message: validationError
        };
    }

    const existingCategory = await Category.findOne({
        name: {
            $regex: `^${escapeRegex(categoryName)}$`,
            $options: "i"
        }
    });

    if (existingCategory) {
        return {
            success: false,
            message: "Category already exists."
        };
    }

    const category = await Category.create({
        name: categoryName,
        description:
            typeof description === "string"
                ? description.trim()
                : ""
    });

    return {
        success: true,
        category
    };
};

// Get category by ID
const getCategoryById = async (id) => {
    return await Category.findById(id);
};

// Update category
const updateCategory = async (id, name, description) => {
    const category = await Category.findById(id);

    if (!category) {
        return {
            success: false,
            notFound: true
        };
    }

    const categoryName =
        typeof name === "string" ? name.trim() : "";

    const validationError = validateCategoryName(categoryName);

    if (validationError) {
        return {
            success: false,
            message: validationError,
            category
        };
    }

    const existingCategory = await Category.findOne({
        _id: { $ne: id },
        name: {
            $regex: `^${escapeRegex(categoryName)}$`,
            $options: "i"
        }
    });

    if (existingCategory) {
        return {
            success: false,
            message: "Category already exists.",
            category
        };
    }

    category.name = categoryName;
    category.description =
        typeof description === "string"
            ? description.trim()
            : "";

    await category.save();

    return {
        success: true,
        category
    };
};

// Update category listing status
const updateCategoryListingStatus = async (id, isListed) => {
    return await Category.findByIdAndUpdate(
        id,
        { isListed },
        { new: true }
    );
};

export default {
    getCategoriesPageData,
    addCategory,
    getCategoryById,
    updateCategory,
    updateCategoryListingStatus
};
