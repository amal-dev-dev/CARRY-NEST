import express from 'express';
const router = express.Router();
import userLogin from '../../Controller/user/login.js';
import userSignup from '../../Controller/user/signup.js';
import { requireAuth, isLoggedIn } from '../../Middleware/userAuth.js';

router.get('/login', isLoggedIn, userLogin.loadLogin);
router.post('/login', userLogin.login);

router.get('/signup', isLoggedIn, userSignup.loadSignup);
router.post('/signup', userSignup.signup);

router.get('/home', requireAuth, userLogin.loadHome);


export default router;