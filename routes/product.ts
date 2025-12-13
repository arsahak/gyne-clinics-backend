import express from "express";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  getLowStockProducts,
  getProduct,
  getProducts,
  updateProduct,
  updateProductStock,
} from "../controller/productController";
import { authenticate, authorize } from "../middleware/auth";
import { uploadMultiple } from "../middleware/upload";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get(
  "/low-stock",
  authenticate,
  authorize("admin", "staff"),
  getLowStockProducts
);
router.get("/:id", getProduct);

// Protected routes (admin/staff only)
router.post(
  "/",
  authenticate,
  authorize("admin", "staff"),
  uploadMultiple("images", 10),
  createProduct
);
router.put(
  "/:id",
  authenticate,
  authorize("admin", "staff"),
  uploadMultiple("images", 10),
  updateProduct
);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteProduct);
router.patch(
  "/:id/stock",
  authenticate,
  authorize("admin", "staff"),
  updateProductStock
);
router.post(
  "/bulk-update",
  authenticate,
  authorize("admin", "staff"),
  bulkUpdateProducts
);

export default router;
