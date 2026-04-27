const isLogin = (req, res, next) => {
    if(req.session.user) {
        res.redirect('/user/userhome');
    } else {
        next();
    }
}

export default isLogin