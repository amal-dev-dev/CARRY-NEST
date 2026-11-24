import Address from "../../Model/addressModel.js";
import User from "../../Model/userModel.js";
import addressService from "../../Service/user/addressService.js";

// LOAD ADDRESS PAGE
const loadAddress = async (req, res) => {

    try {

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        // USER DATA
        const user = await User.findById(userId);

        // ADDRESS DATA
        const addresses = await Address.find({ userId });

        const message = req.session.message || null;
        delete req.session.message;

        res.render("user/address", {
            user,
            addresses,
            message
        });

    } catch (error) {

        console.log(error);

    }

};


// LOAD ADD ADDRESS PAGE
const loadAddAddress = async (req, res) => {

    try {

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        res.render("user/add-address", {

            user,
            errors: {},
            formData: {}

        });

    } catch (error) {

        console.log("LOAD ADD ADDRESS ERROR:", error);

        res.redirect("/user/address");

    }

};


// ADD ADDRESS
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const isAddressPage = req.body.from === "address";

        // Handle unauthenticated user
        if (!userId) {
            if (isAddressPage) {
                return res.redirect("/user/login");
            }

            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        // Validate address
        const errors = addressService.validateAddress(req.body);

        if (Object.keys(errors).length > 0) {

            // Standalone Add Address page
            if (isAddressPage) {
                req.session.addressErrors = errors;
                req.session.addressFormData = req.body;

                return res.redirect("/user/add-address");
            }

            // Checkout page
            return res.status(400).json({
                success: false,
                errors
            });
        }

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            houseName,
            landmark
        } = req.body;

        const newAddress = await Address.create({
            userId,
            type,
            fullName: fullName.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            houseName: houseName?.trim() || "",
            landmark: landmark?.trim() || ""
        });

        // Standalone Add Address page
        if (isAddressPage) {
            req.session.message = {
                type: "success",
                title: "Address Added!",
                text: "Your address has been added successfully."
            };

            return res.redirect("/user/address");
        }

        // Checkout page
        return res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: newAddress
        });

    } catch (error) {
        console.error("ADD ADDRESS ERROR:", error);

        if (req.body.from === "address") {
            req.session.message = {
                type: "error",
                title: "Address Not Added",
                text: "Unable to add address. Please try again."
            };

            return res.redirect("/user/add-address");
        }

        return res.status(500).json({
            success: false,
            message: "Unable to add address. Please try again."
        });
    }
};


// LOAD EDIT PAGE
const loadEditAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const address = await Address.findOne({
            _id: req.params.id,
            userId
        });

        if (!address) {
            req.session.message = {
                type: "error",
                title: "Address Not Found",
                text: "The address could not be found."
            };

            return res.redirect("/user/address");
        }

        return res.render("user/edit-address", { address });

    } catch (error) {
        console.error("LOAD EDIT ADDRESS ERROR:", error);
        return res.redirect("/user/address");
    }
};


// UPDATE ADDRESS

const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        const isAddressPage = req.body.from === "address";

        if (!userId) {
            if (isAddressPage) {
                return res.redirect("/user/login");
            }

            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        // Validate address
        const errors = addressService.validateAddress(req.body);

        if (Object.keys(errors).length > 0) {

            // Address management page
            if (isAddressPage) {
                req.session.addressErrors = errors;
                req.session.addressFormData = req.body;

                return res.redirect(`/user/address/edit/${addressId}`);
            }

            // Checkout page
            return res.status(400).json({
                success: false,
                errors
            });
        }

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            houseName,
            landmark
        } = req.body;

        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, userId },
            {
                type,
                fullName: fullName.trim(),
                mobile: mobile.trim(),
                address: address.trim(),
                city: city.trim(),
                state: state.trim(),
                pincode: pincode.trim(),
                houseName: houseName?.trim() || "",
                landmark: landmark?.trim() || ""
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!updatedAddress) {

            if (isAddressPage) {
                req.session.message = {
                    type: "error",
                    title: "Address Not Found",
                    text: "The address could not be found."
                };

                return res.redirect("/user/address");
            }

            return res.status(404).json({
                success: false,
                message: "Address not found"
            });
        }

        // Address management page
        if (isAddressPage) {
            req.session.message = {
                type: "success",
                title: "Address Updated!",
                text: "Your address has been updated successfully."
            };

            return res.redirect("/user/address");
        }

        // Checkout page
        return res.status(200).json({
            success: true,
            message: "Address updated successfully",
            address: updatedAddress
        });

    } catch (error) {
        console.error("UPDATE ADDRESS ERROR:", error);

        if (req.body.from === "address") {
            req.session.message = {
                type: "error",
                title: "Update Failed",
                text: "Unable to update address. Please try again."
            };

            return res.redirect("/user/address");
        }

        return res.status(500).json({
            success: false,
            message: "Unable to update address. Please try again."
        });
    }
};



// DELETE ADDRESS
const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user;

        // Identify where the request comes from
        const isAddressPage = req.body?.from === "address";

        if (!userId) {
            if (isAddressPage) {
                return res.redirect("/user/login");
            }

            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        // Delete only the logged-in user's address
        const deletedAddress = await Address.findOneAndDelete({
            _id: id,
            userId
        });

        if (!deletedAddress) {
            if (isAddressPage) {
                req.session.message = {
                    type: "error",
                    title: "Address Not Found",
                    text: "The address could not be found."
                };

                return res.redirect("/user/address");
            }

            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        // Address management page
        if (isAddressPage) {
            req.session.message = {
                type: "success",
                title: "Address Deleted!",
                text: "Your address has been deleted successfully."
            };

            return res.redirect("/user/address");
        }

        // Checkout page
        return res.status(200).json({
            success: true,
            message: "Address deleted successfully."
        });

    } catch (error) {
        console.error("DELETE ADDRESS ERROR:", error);

        if (req.body?.from === "address") {
            req.session.message = {
                type: "error",
                title: "Delete Failed",
                text: "Unable to delete address. Please try again."
            };

            return res.redirect("/user/address");
        }

        return res.status(500).json({
            success: false,
            message: "Unable to delete address."
        });
    }
};

export default {
    loadAddress,
    loadAddAddress,
    addAddress,
    loadEditAddress,
    updateAddress,
    deleteAddress

};