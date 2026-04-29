import Users from '../../Model/user/userModel.js';
import bcrypt from 'bcrypt';

const login = async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const password = req.body.password;

        const user = await Users.findOne({ email });

        if (!user) {
            return res.render('user/login', { message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
        return res.render('user/login', { message: "Incorrect password" });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email
        };

        res.redirect('/user/home');

    } catch (error) {
        res.render('user/login', { message: "Something went wrong" });
    }
};

const loadLogin = (req, res) => {
    res.render('user/login');
};

const loadHome = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/user/login');
    }

    res.render('user/home');
};

export default {
    login,
    loadLogin,
    loadHome
};