
import brandService from "../../Service/admin/brandService.js";


// BRANDS PAGE
const loadBrands = async (req, res) => {
    try {
        const brands = await brandService.getAllBrands();

        return res.render("admin/brands", {
            brands,
            error: null
        });

    } catch (error) {
        console.error("LOAD BRANDS ERROR:", error);

        return res.status(500).send("Unable to load brands");
    }
};


// ADD BRAND
const addBrand = async (req, res) => {
    try {
        const { name, logo } = req.body;

        const result = await brandService.addBrand(name, logo);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });
        }

        return res.status(result.statusCode).json({
            success: true,
            message: result.message,
            brand: result.brand
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

        const result = await brandService.updateBrand(
            req.params.id,
            name,
            logo
        );

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message: result.message,
            brand: result.brand
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
        const result = await brandService.toggleBrandStatus(req.params.id);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message: result.message,
            isActive: result.isActive
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
