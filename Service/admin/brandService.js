
import Brand from "../../Model/brandModel.js";
import Product from "../../Model/productModel.js";


const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const getAllBrands = async () => {

    const brands = await Brand.find()
        .sort({ createdAt: -1 })
        .lean();

    const brandsWithCount = await Promise.all(
        brands.map(async (brand) => {

            const productCount = await Product.countDocuments({
                brand: brand.name
            });

            return {
                ...brand,
                productCount
            };
        })
    );

    return brandsWithCount;
};


const addBrand = async (name, logo) => {

    if (
        typeof name !== "string" ||
        typeof logo !== "string" ||
        !name.trim() ||
        !logo.trim()
    ) {
        return {
            success: false,
            statusCode: 400,
            message: "Brand name and logo are required"
        };
    }

    const trimmedName = name.trim();
    const trimmedLogo = logo.trim();

    const existingBrand = await Brand.findOne({
        name: {
            $regex: `^${escapeRegex(trimmedName)}$`,
            $options: "i"
        }
    });

    if (existingBrand) {
        return {
            success: false,
            statusCode: 409,
            message: "This brand already exists"
        };
    }

    const brand = await Brand.create({
        name: trimmedName,
        logo: trimmedLogo
    });

    return {
        success: true,
        statusCode: 201,
        message: "Brand added successfully",
        brand
    };
};


const updateBrand = async (brandId, name, logo) => {

    if (
        typeof name !== "string" ||
        typeof logo !== "string" ||
        !name.trim() ||
        !logo.trim()
    ) {
        return {
            success: false,
            statusCode: 400,
            message: "Brand name and logo are required"
        };
    }

    const brand = await Brand.findById(brandId);

    if (!brand) {
        return {
            success: false,
            statusCode: 404,
            message: "Brand not found"
        };
    }

    const trimmedName = name.trim();
    const trimmedLogo = logo.trim();

    const duplicate = await Brand.findOne({
        _id: { $ne: brand._id },
        name: {
            $regex: `^${escapeRegex(trimmedName)}$`,
            $options: "i"
        }
    });

    if (duplicate) {
        return {
            success: false,
            statusCode: 409,
            message: "Another brand already uses this name"
        };
    }

    brand.name = trimmedName;
    brand.logo = trimmedLogo;

    await brand.save();

    return {
        success: true,
        message: "Brand updated successfully",
        brand
    };
};


const toggleBrandStatus = async (brandId) => {

    const brand = await Brand.findById(brandId);

    if (!brand) {
        return {
            success: false,
            statusCode: 404,
            message: "Brand not found"
        };
    }

    brand.isActive = !brand.isActive;

    await brand.save();

    return {
        success: true,
        message: `Brand ${brand.isActive ? "activated" : "deactivated"} successfully`,
        isActive: brand.isActive
    };
};


export default {
    getAllBrands,
    addBrand,
    updateBrand,
    toggleBrandStatus
};
