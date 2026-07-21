import express from "express";
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import { loginValidation, registerValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post("/register", registerValidation, registerUser);
router.post("/login", loginValidation, loginUser);
router.get("/me", protect, getCurrentUser);

export default router;
