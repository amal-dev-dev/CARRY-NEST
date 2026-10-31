
import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Brand name is required"],
            trim: true,
            unique: true,
            maxlength: [50, "Brand name cannot exceed 50 characters"]
        },

        logo: {
            type: String,
            required: [true, "Brand logo is required"]
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Brand = mongoose.model("Brand", brandSchema);

export default Brand;
