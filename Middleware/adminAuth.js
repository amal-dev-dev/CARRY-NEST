export const adminAuth = (req, res, next) => {

    if(req.session.admin){

        next();

    } else {

        return res.redirect("/admin/login");

    }

};

export const adminLoggedIn = (req, res, next) => {

    if(req.session.admin){

        return res.redirect("/admin/dashboard");

    }

    next();

};