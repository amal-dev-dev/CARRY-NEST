export const adminAuth = (req,res,next)=>{

    if(!req.session.admin){
        return res.redirect("/admin/login");
    }

    next();

}

export const adminLoggedIn = (req, res, next) => {

    if(req.session.admin){

        return res.redirect("/admin/dashboard");

    }

    next();

};