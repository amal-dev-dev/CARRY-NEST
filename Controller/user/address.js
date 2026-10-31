import Address from "../../Model/addressModel.js";
import User from "../../Model/userModel.js";


// LOAD ADDRESS PAGE
const loadAddress = async (req, res) => {

    try {

        const userId = req.session.user;

        // USER DATA
        const user = await User.findById(userId);

        // ADDRESS DATA
        const addresses = await Address.find({ userId });

        res.render("user/address", {

            user,
            addresses

        });

    } catch (error) {

        console.log(error);

    }

};


// LOAD ADD ADDRESS PAGE
const loadAddAddress = async (req, res) => {

    try {

        const userId = req.session.user;

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

        if (!userId) {

            if (req.is("application/json")) {
                return res.status(401).json({
                    success: false,
                    message: "Please login first"
                });
            }

            return res.redirect("/user/login");
        }

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            landmark
        } = req.body;


        // =========================
        // INPUT VALIDATION
        // =========================

        const errors = {};

        // Full name
        if (!fullName || !fullName.trim()) {
            errors.fullName = "Full name is required";
        } else if (!/^[A-Za-z\s]+$/.test(fullName.trim())) {
            errors.fullName = "Full name should contain only letters";
        } else if (fullName.trim().length < 3) {
            errors.fullName = "Full name must be at least 3 characters";
        }


        // Mobile
        if (!mobile || !mobile.trim()) {
            errors.mobile = "Mobile number is required";
        } else if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
            errors.mobile = "Enter a valid 10-digit mobile number";
        }


        // Address
        if (!address || !address.trim()) {
            errors.address = "Address is required";
        } else if (address.trim().length < 5) {
            errors.address = "Address must be at least 5 characters";
        }


        // City
        if (!city || !city.trim()) {
            errors.city = "City is required";
        } else if (!/^[A-Za-z\s]+$/.test(city.trim())) {
            errors.city = "City should contain only letters";
        }


        // State
        if (!state || !state.trim()) {
            errors.state = "State is required";
        } else if (!/^[A-Za-z\s]+$/.test(state.trim())) {
            errors.state = "State should contain only letters";
        }


        // Pincode
        if (!pincode || !pincode.trim()) {
            errors.pincode = "Pincode is required";
        } else if (!/^\d{6}$/.test(pincode.trim())) {
            errors.pincode = "Pincode must be exactly 6 digits";
        }


        // Landmark - optional
        if (landmark && landmark.trim().length > 100) {
            errors.landmark = "Landmark is too long";
        }


        // =========================
        // RETURN VALIDATION ERRORS
        // =========================

        if (Object.keys(errors).length > 0) {

            if (req.is("application/json")) {

                return res.status(400).json({
                    success: false,
                    errors
                });

            }

            const user = await User.findById(userId);

            return res.status(400).render("user/add-address", {
                user,
                errors,
                formData: req.body
            });
        }


        // =========================
        // CREATE ADDRESS
        // =========================

        const newAddress = new Address({
            userId,
            type,
            fullName: fullName.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            landmark: landmark ? landmark.trim() : ""
        });


        await newAddress.save();

        // =========================
        // CHECKOUT AJAX REQUEST
        // =========================

        if (req.is("application/json")) {

            return res.status(201).json({
                success: true,
                message: "Address added successfully",
                address: newAddress
            });

        }


        // =========================
        // NORMAL ADDRESS PAGE FORM
        // =========================

        return res.redirect("/user/address");


    } catch (error) {
        console.error("ADD ADDRESS ERROR:", error.stack || error);

        if (req.is("application/json")) {
            return res.status(500).json({
                success: false,
                message: "Unable to add address"
            });
        }

        return res.redirect("/user/address");
    }
};


// LOAD EDIT PAGE
const loadEditAddress = async (req, res) => {

    try {

        const address = await Address.findById(req.params.id);

        res.render("user/edit-address", { address });

    } catch (error) {

        console.log(error);

    }

};


// UPDATE ADDRESS
const updateAddress = async (req, res) => {

    try {

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            landmark
        } = req.body;

        await Address.findByIdAndUpdate(req.params.id, {

            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            landmark

        });

        res.redirect("/user/address");

    } catch (error) {

        console.log(error);

    }

};


// DELETE ADDRESS
const deleteAddress = async (req, res) => {

    try {

        await Address.findByIdAndDelete(req.params.id);
        res.redirect("/user/address");

    } catch (error) {

        console.log(error);

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