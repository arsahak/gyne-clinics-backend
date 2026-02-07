import mongoose, { Document, Schema } from "mongoose";

export type MessageSender = "user" | "ai";
export type ChatbotType = "general" | "urogynaecology" | "aesthetic" | "menopause";

export interface IMessage {
  sender: MessageSender;
  text: string;
  timestamp: Date;
  sources?: string[]; // Referenced documents
}

export interface IConversation extends Document {
  sessionId: string;
  chatbotType: ChatbotType;
  messages: IMessage[];
  startedAt: Date;
  lastMessageAt: Date;
  userId?: string; // Optional: if users are logged in
  metadata?: Record<string, any>;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: {
      type: String,
      required: true,
      enum: ["user", "ai"],
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    sources: {
      type: [String],
    },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatbotType: {
      type: String,
      required: true,
      enum: ["general", "urogynaecology", "aesthetic", "menopause"],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ chatbotType: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1 });

const Conversation = mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
);

export default Conversation;
