import { Request, Response } from "express";
import Conversation from "../modal/conversation";
import { generateRAGResponse, generateSimpleResponse } from "../services/ragService";
import { ChatbotType } from "../modal/knowledgeBase";
import KnowledgeBase from "../modal/knowledgeBase";

/**
 * Handle chat query
 * POST /api/chatbot/query
 */
export const handleChatQuery = async (req: Request, res: Response) => {
  try {
    const { message, chatbotType, sessionId, conversationHistory } = req.body;

    // Validation
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!chatbotType || !["general", "urogynaecology", "aesthetic", "menopause"].includes(chatbotType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot type",
      });
    }

    console.log(`💬 Received query for ${chatbotType}: ${message}`);

    // Check if knowledge base exists for this chatbot type
    const hasKnowledgeBase = await KnowledgeBase.exists({
      chatbotType,
      status: "completed",
    });

    let response: string;
    let sources: string[] = [];
    let relevantChunks: Array<{ text: string; fileName: string; score: number }> = [];

    if (hasKnowledgeBase) {
      // Use RAG (Retrieval Augmented Generation)
      console.log("🔍 Using RAG with knowledge base");
      const ragResult = await generateRAGResponse(
        message,
        chatbotType as ChatbotType,
        conversationHistory
      );
      response = ragResult.response;
      sources = ragResult.sources;
      relevantChunks = ragResult.relevantChunks;
    } else {
      // Use simple OpenAI response (no knowledge base)
      console.log("💡 Using simple OpenAI response (no knowledge base)");
      response = await generateSimpleResponse(message, chatbotType as ChatbotType);
    }

    // Save conversation to database (optional)
    if (sessionId) {
      try {
        await saveConversation(
          sessionId,
          chatbotType as ChatbotType,
          message,
          response,
          sources
        );
      } catch (error) {
        console.error("⚠️ Failed to save conversation:", error);
        // Don't fail the request if saving conversation fails
      }
    }

    res.json({
      success: true,
      data: {
        response,
        sources,
        hasKnowledgeBase: !!hasKnowledgeBase,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("❌ Error handling chat query:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process chat query",
      error: error.message,
    });
  }
};

/**
 * Save conversation to database
 */
const saveConversation = async (
  sessionId: string,
  chatbotType: ChatbotType,
  userMessage: string,
  aiResponse: string,
  sources: string[]
) => {
  try {
    let conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        sessionId,
        chatbotType,
        messages: [],
      });
    }

    // Add user message
    conversation.messages.push({
      sender: "user",
      text: userMessage,
      timestamp: new Date(),
    });

    // Add AI response
    conversation.messages.push({
      sender: "ai",
      text: aiResponse,
      timestamp: new Date(),
      sources,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    console.log(`💾 Saved conversation: ${sessionId}`);
  } catch (error) {
    console.error("❌ Error saving conversation:", error);
    throw error;
  }
};

/**
 * Get conversation history
 * GET /api/chatbot/conversation/:sessionId
 */
export const getConversation = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const conversation = await Conversation.findOne({ sessionId }).select("-__v");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error("❌ Error getting conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get conversation",
      error: error.message,
    });
  }
};

/**
 * Get all conversations for a chatbot type
 * GET /api/chatbot/conversations
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const { chatbotType, limit = 50 } = req.query;

    const filter: any = {};
    if (chatbotType) filter.chatbotType = chatbotType;

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .select("-__v");

    res.json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error: any) {
    console.error("❌ Error getting conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get conversations",
      error: error.message,
    });
  }
};

/**
 * Delete a conversation
 * DELETE /api/chatbot/conversation/:sessionId
 */
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const conversation = await Conversation.findOneAndDelete({ sessionId });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ Error deleting conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete conversation",
      error: error.message,
    });
  }
};

/**
 * Get chatbot stats
 * GET /api/chatbot/stats
 */
export const getChatbotStats = async (req: Request, res: Response) => {
  try {
    const stats = await Conversation.aggregate([
      {
        $group: {
          _id: "$chatbotType",
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: { $size: "$messages" } },
          avgMessagesPerConversation: { $avg: { $size: "$messages" } },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("❌ Error getting chatbot stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get chatbot stats",
      error: error.message,
    });
  }
};

export default {
  handleChatQuery,
  getConversation,
  getConversations,
  deleteConversation,
  getChatbotStats,
};
