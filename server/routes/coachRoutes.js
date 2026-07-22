import express from "express";
import protect from "../middleware/authMiddleware.js";
import generationRateLimit from "../middleware/generationRateLimit.js";
import { createCoachChat, deleteCoachChat, getCoachChat, getCoachChats, streamCoachChat, updateCoachChat } from "../controllers/coachController.js";

const router = express.Router();
router.use(protect);
router.post("/chat", generationRateLimit, streamCoachChat);
router.route("/chats").get(getCoachChats).post(createCoachChat);
router.route("/chats/:id").get(getCoachChat).patch(updateCoachChat).delete(deleteCoachChat);
export default router;
