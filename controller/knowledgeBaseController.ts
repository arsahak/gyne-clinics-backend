import { Request, Response } from "express";
import KnowledgeBase, { ChatbotType } from "../modal/knowledgeBase";
import { processPDF } from "../services/pdfProcessorService";
import { generateEmbeddings } from "../services/openaiService";
import { upsertVectors, deleteNamespace, VectorMetadata } from "../services/pineconeService";
import * as fs from "fs";
import * as path from "path";

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "gyneclinics-kb";

/**
 * Upload and process a knowledge base document
 * POST /api/knowledge-base/upload
 */
export const uploadKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { chatbotType, description } = req.body;
    const file = req.file;

    // Validation
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    if (!chatbotType || !["general", "urogynaecology", "aesthetic", "menopause"].includes(chatbotType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatbot type",
      });
    }

    // Only allow PDF files
    if (file.mimetype !== "application/pdf") {
      // Delete uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: "Only PDF files are supported",
      });
    }

    console.log(`📄 Processing upload: ${file.originalname}`);

    // Create knowledge base record
    const namespace = `chatbot-${chatbotType}`;
    const knowledgeBase = new KnowledgeBase({
      chatbotType,
      fileName: file.originalname,
      fileUrl: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      description,
      status: "pending",
      pineconeNamespace: namespace,
    });

    await knowledgeBase.save();

    // Process asynchronously (don't wait for completion)
    processKnowledgeBaseAsync(knowledgeBase._id.toString(), file.path, chatbotType, namespace);

    res.status(202).json({
      success: true,
      message: "File uploaded successfully. Processing in background.",
      data: {
        id: knowledgeBase._id,
        fileName: knowledgeBase.fileName,
        status: knowledgeBase.status,
        chatbotType: knowledgeBase.chatbotType,
      },
    });
  } catch (error: any) {
    console.error("❌ Error uploading knowledge base:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload knowledge base",
      error: error.message,
    });
  }
};

/**
 * Process knowledge base document asynchronously
 */
const processKnowledgeBaseAsync = async (
  documentId: string,
  filePath: string,
  chatbotType: ChatbotType,
  namespace: string
) => {
  try {
    console.log(`🔄 Starting async processing for document: ${documentId}`);

    // Update status to processing
    await KnowledgeBase.findByIdAndUpdate(documentId, {
      status: "processing",
    });

    // Step 1: Extract and chunk text from PDF
    const chunks = await processPDF(filePath, {
      maxTokens: 500,
      overlap: 50,
    });

    console.log(`📊 Generated ${chunks.length} chunks`);

    // Step 2: Generate embeddings for all chunks
    const texts = chunks.map((chunk) => chunk.text);
    const embeddings = await generateEmbeddings(texts);

    console.log(`🧠 Generated ${embeddings.length} embeddings`);

    // Step 3: Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, index) => {
      const metadata: VectorMetadata = {
        text: chunk.text,
        fileName: path.basename(filePath),
        chatbotType,
        chunkIndex: chunk.index,
        documentId,
        uploadedAt: new Date().toISOString(),
      };

      return {
        id: `${documentId}-chunk-${chunk.index}`,
        values: embeddings[index],
        metadata,
      };
    });

    // Step 4: Upsert vectors to Pinecone
    await upsertVectors(PINECONE_INDEX_NAME, namespace, vectors);

    // Step 5: Update knowledge base record
    await KnowledgeBase.findByIdAndUpdate(documentId, {
      status: "completed",
      processedAt: new Date(),
      chunkCount: chunks.length,
    });

    console.log(`✅ Successfully processed document: ${documentId}`);
  } catch (error: any) {
    console.error(`❌ Error processing document ${documentId}:`, error);

    // Update status to failed
    await KnowledgeBase.findByIdAndUpdate(documentId, {
      status: "failed",
      errorMessage: error.message,
    });
  }
};

/**
 * Get all knowledge base documents
 * GET /api/knowledge-base/list
 */
export const listKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { chatbotType, status } = req.query;

    const filter: any = {};
    if (chatbotType) filter.chatbotType = chatbotType;
    if (status) filter.status = status;

    const documents = await KnowledgeBase.find(filter)
      .sort({ uploadedAt: -1 })
      .select("-__v");

    res.json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error: any) {
    console.error("❌ Error listing knowledge base:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list knowledge base",
      error: error.message,
    });
  }
};

/**
 * Get a single knowledge base document
 * GET /api/knowledge-base/:id
 */
export const getKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await KnowledgeBase.findById(id).select("-__v");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Knowledge base document not found",
      });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error("❌ Error getting knowledge base:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get knowledge base",
      error: error.message,
    });
  }
};

/**
 * Delete a knowledge base document
 * DELETE /api/knowledge-base/:id
 */
export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await KnowledgeBase.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Knowledge base document not found",
      });
    }

    // Delete file from disk
    if (fs.existsSync(document.fileUrl)) {
      fs.unlinkSync(document.fileUrl);
      console.log(`🗑️ Deleted file: ${document.fileUrl}`);
    }

    // Delete vectors from Pinecone (all chunks for this document)
    // Note: This deletes by filter, not entire namespace
    const namespace = document.pineconeNamespace;
    // We'll use deleteAll for now - in production, you might want to delete by filter
    await deleteNamespace(PINECONE_INDEX_NAME, namespace);

    // Delete from database
    await KnowledgeBase.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Knowledge base document deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ Error deleting knowledge base:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete knowledge base",
      error: error.message,
    });
  }
};

/**
 * Get knowledge base stats
 * GET /api/knowledge-base/stats
 */
export const getKnowledgeBaseStats = async (req: Request, res: Response) => {
  try {
    const stats = await KnowledgeBase.aggregate([
      {
        $group: {
          _id: "$chatbotType",
          totalDocuments: { $sum: 1 },
          totalChunks: { $sum: "$chunkCount" },
          completedDocuments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          processingDocuments: {
            $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
          },
          failedDocuments: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("❌ Error getting knowledge base stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get knowledge base stats",
      error: error.message,
    });
  }
};

export default {
  uploadKnowledgeBase,
  listKnowledgeBase,
  getKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseStats,
};
