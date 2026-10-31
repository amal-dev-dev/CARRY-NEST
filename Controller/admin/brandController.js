
import Brand from "../../Model/brandModel.js";
import Product from "../../Model/productModel.js";

// BRANDS PAGE
const loadBrands = async (req, res) => {
    try {
        const brands = await Brand.find().sort({ createdAt: -1 }).lean();

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

        res.render("admin/brands", {
            brands: brandsWithCount,
            error: null
        });
    } catch (error) {
        console.error("LOAD BRANDS ERROR:", error);
        res.status(500).send("Unable to load brands");
    }
};

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ADD BRAND
const addBrand = async (req, res) => {
    try {
        const { name, logo } = req.body;

        if (!name?.trim() || !logo?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name and logo are required"
            });
        }

        const existingBrand = await Brand.findOne({
            name: {
                $regex: `^${escapeRegex(name.trim())}$`,
                $options: "i"
            }
        });

        if (existingBrand) {
            return res.status(409).json({
                success: false,
                message: "This brand already exists"
            });
        }

        const brand = await Brand.create({
            name: name.trim(),
            logo: logo.trim()
        });

        return res.status(201).json({
            success: true,
            message: "Brand added successfully",
            brand
        });
    } catch (error) {
        console.error("ADD BRAND ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add brand"
        });
    }
};

// EDIT BRAND
const updateBrand = async (req, res) => {
    try {
        const { name, logo } = req.body;

        if (!name?.trim() || !logo?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name and logo are required"
            });
        }

        const brand = await Brand.findById(req.params.id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: "Brand not found"
            });
        }

        const duplicate = await Brand.findOne({
            _id: { $ne: brand._id },
            name: {
                $regex: `^${escapeRegex(name.trim())}$`,
                $options: "i"
            }
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Another brand already uses this name"
            });
        }

        brand.name = name.trim();
        brand.logo = logo.trim();

        await brand.save();

        return res.json({
            success: true,
            message: "Brand updated successfully",
            brand
        });
    } catch (error) {
        console.error("UPDATE BRAND ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update brand"
        });
    }
};

// CHANGE BRAND STATUS
const toggleBrandStatus = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: "Brand not found"
            });
        }

        brand.isActive = !brand.isActive;
        await brand.save();

        return res.json({
            success: true,
            message: `Brand ${brand.isActive ? "activated" : "deactivated"} successfully`,
            isActive: brand.isActive
        });
    } catch (error) {
        console.error("TOGGLE BRAND ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to change brand status"
        });
    }
};

export default {
    loadBrands,
    addBrand,
    updateBrand,
    toggleBrandStatus
};
