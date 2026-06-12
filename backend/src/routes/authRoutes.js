import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import {
  login,
  register,
  getProfile,
  updateProfile,
} from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;
