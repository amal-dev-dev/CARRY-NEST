import express from 'express';
const router = express.Router();
import userController from '../Controller/user/userController';
import auth from '../Middleware/userAuth';

router.get('/login',auth.isLogin, userController.isLogin);
router.post('/login',userController.login);

export default router;