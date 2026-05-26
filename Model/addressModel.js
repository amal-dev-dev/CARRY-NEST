import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    type: {
        type: String,
        default: "Home"
    },

    fullName: String,
    mobile: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    isDefault: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

const Address = mongoose.model("Address", addressSchema);

export default Address;