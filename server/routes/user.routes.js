import {Router} from 'express';
import { changedPassword, forgotPassword, getProfile, login, logout, register, resetPassword, updateUser } from '../controllers/user.controller.js';
import { isLoggedIn } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/multer.middleware.js';

const router = Router();

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', isLoggedIn, getProfile);
router.post('/reset', forgotPassword);
router.post('/reset/:resetToken', resetPassword)
router.post('/changed-password', isLoggedIn, changedPassword);
router.post('/update/:id', isLoggedIn, upload.single('avatar'), updateUser)

export default router;