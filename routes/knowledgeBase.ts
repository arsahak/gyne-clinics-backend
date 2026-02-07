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
const uploadDir = path.join(process.cwd(), "uploads", "knowledge-base");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
