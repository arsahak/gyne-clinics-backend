import express from "express";
import {
  createReview,
  deleteReview,
  getReviews,
  replyToReview,
  updateReviewStatus,
} from "../controller/reviewController";
import { authenticate, authorize } from "../middleware/auth";

const router = express.Router();

// Public routes (authentication handled in controller for "me" parameter)
router.get("/", getReviews);

// Customer routes
router.post("/", authenticate, createReview);

// Admin/Staff routes
router.patch("/:id/status", authenticate, authorize("admin", "staff"), updateReviewStatus);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteReview);
router.post("/:id/reply", authenticate, authorize("admin", "staff"), replyToReview);

export default router;
