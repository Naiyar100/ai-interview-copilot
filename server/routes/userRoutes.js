import express from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import { profileValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.route("/me").get(protect, getUserProfile).put(protect, profileValidation, updateUserProfile);

export default router;
