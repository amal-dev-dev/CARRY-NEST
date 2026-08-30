import User from "../Model/userModel.js";

// Protect private routes
export const requireAuth = async (req,res,next)=>{

    if(!req.session.user){
        return res.redirect("/user/login");
    }

    const user = await User.findById(req.session.user);

    if(!user || user.isBlocked){

        req.session.destroy(()=>{
            res.clearCookie("connect.sid");
            return res.redirect("/user/login");
        });

        return;
    }

    next();
}

// Prevent logged-in users from accessing login/signup
export const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/user/home');
    }
    next();
};
