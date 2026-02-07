import express from "express";
import {
  handleChatQuery,
  getConversation,
  getConversations,
  deleteConversation,
  getChatbotStats,
} from "../controller/chatbotController";

const router = express.Router();

// Routes
router.post("/query", handleChatQuery);
router.get("/conversation/:sessionId", getConversation);
router.get("/conversations", getConversations);
router.delete("/conversation/:sessionId", deleteConversation);
router.get("/stats", getChatbotStats);

export default router;
