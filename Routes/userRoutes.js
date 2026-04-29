import express from 'express';
const router = express.Router();
import userController from '../Controller/user/login.js';
import auth from '../Middleware/userAuth.js';

router.get('/login', auth, userController.loadLogin);
router.post('/login', userController.login);
router.get('/home', userController.loadHome);

export default router;