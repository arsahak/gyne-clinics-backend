import express from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import {
  uploadKnowledgeBase,
  listKnowledgeBase,
  getKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseStats,
} from "../controller/knowledgeBaseController";

const router = express.Router();

// Configure multer for file uploads
// Use /tmp for Vercel serverless environment, otherwise use local uploads
const isVercel = process.env.VERCEL === "1";
const uploadDir = isVercel
  ? path.join("/tmp", "knowledge-base")
  : path.join(process.cwd(), "uploads", "knowledge-base");

// Ensure upload directory exists (only works in /tmp on Vercel)
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn("Could not create upload directory:", error);
  // Don't fail - multer will handle the error when trying to save
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Routes
router.post("/upload", upload.single("file"), uploadKnowledgeBase);
router.get("/list", listKnowledgeBase);
router.get("/stats", getKnowledgeBaseStats);
router.get("/:id", getKnowledgeBase);
router.delete("/:id", deleteKnowledgeBase);

export default router;
