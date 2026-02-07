import mongoose, { Document, Schema } from "mongoose";

export type ChatbotType = "general" | "urogynaecology" | "aesthetic" | "menopause";
export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface IKnowledgeBase extends Document {
  chatbotType: ChatbotType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  uploadedAt: Date;
  processedAt?: Date;
  chunkCount: number;
  status: ProcessingStatus;
  errorMessage?: string;
  pineconeNamespace: string;
  metadata?: Record<string, any>;
}

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    chatbotType: {
      type: String,
      required: true,
      enum: ["general", "urogynaecology", "aesthetic", "menopause"],
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: {
      type: String,
    },
    pineconeNamespace: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
knowledgeBaseSchema.index({ chatbotType: 1, status: 1 });
knowledgeBaseSchema.index({ uploadedAt: -1 });

const KnowledgeBase = mongoose.model<IKnowledgeBase>(
  "KnowledgeBase",
  knowledgeBaseSchema
);

export default KnowledgeBase;
