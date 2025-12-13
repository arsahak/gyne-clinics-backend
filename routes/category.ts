import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  getCategoryTree,
  updateCategory,
} from "../controller/categoryController";
import { authenticate, authorize } from "../middleware/auth";

const router = express.Router();

// Public routes
router.get("/", getCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategory);

// Protected routes (admin/staff only)
router.post("/", authenticate, authorize("admin", "staff"), createCategory);
router.put("/:id", authenticate, authorize("admin", "staff"), updateCategory);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "staff"),
  deleteCategory
);

export default router;
