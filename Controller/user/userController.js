import Users from '../Model/user/userModel';
import bcrypt from 'bcrypt';

const login = async (req, res) => {
    try{
        
        const {email, password} = req.body;
        const user = await Users.findOne({email});
        
        if(!user) return res.render('user/login', {message: "User Not Found"}); 

        const isMatch = await bcrypt.compare(password,user.password);

        if(!isMatch) return res.render('user/login', {message: "Incorrect Password"});

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email
        };

        res.redirect('/user/homepage');

    } catch (error) {
        console.log(error);
        res.render('users/login', {message: "Something went Wrong"});
    }
    
}

const loadLogin = (req, res) => {
    res.render('user/login');
}

export default {
    login,
    loadLogin
}