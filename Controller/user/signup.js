import Users from '../../Model/user/userModel.js';
import bcrypt from 'bcrypt';

const loadSignup = (req, res) => {
    res.render('user/signup');
};

const signup = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            confirmPassword,
            referralCode
        } = req.body;

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (!cleanName || !cleanEmail || !password || !confirmPassword) {
            return res.render('user/signup', { message: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.render('user/signup', { message: "Passwords do not match" });
        }

        if (password.length < 6) {
            return res.render('user/signup', { message: "Password must be at least 6 characters" });
        }

        const existingUser = await Users.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.render('user/signup', { message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new Users({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone, // optional field
            password: hashedPassword,
            referralCode: referralCode || null
        });

        await newUser.save();

         res.redirect('/user/login');

    } catch (error) {
        console.log(error);
        res.render('user/signup', { message: "Signup failed" });
    }
};

export default {
    loadSignup,
    signup
};