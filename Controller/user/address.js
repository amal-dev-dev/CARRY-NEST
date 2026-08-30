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

        const user = await User.findById(userId);

        res.render("user/add-address", {

            user

        });

    } catch (error) {

        console.log(error);

    }

};


// ADD ADDRESS
const addAddress = async (req, res) => {

    try {

         console.log("❌ NORMAL ADD ADDRESS CONTROLLER HIT");

        const userId = req.session.user;

        const {
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            detailAddress,
            landmark
        } = req.body;

        const newAddress = new Address({

            userId,
            type,
            fullName,
            mobile,
            address,
            city,
            state,
            pincode,
            detailAddress,
            landmark

        });

        await newAddress.save();

        console.log("❌ REDIRECTING TO NORMAL ADDRESS");

        res.redirect("/user/address");

    } catch (error) {

        console.log(error);

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
            detailAddress,
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
            detailAddress,
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