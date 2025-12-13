import express from "express";
import {
  createOrder,
  deleteOrder,
  getMyOrders,
  getOrder,
  getOrders,
  getOrderStats,
  getRecentOrders,
  refundOrder,
  updateOrder,
  updateOrderStatus,
  updatePaymentStatus,
} from "../controller/orderController";
import { authenticate, authorize } from "../middleware/auth";

const router = express.Router();

// All routes are protected
router.use(authenticate);

// Admin/Staff routes
router.get("/", authorize("admin", "staff"), getOrders);
router.get("/stats", authorize("admin", "staff"), getOrderStats);
router.get("/recent", authorize("admin", "staff"), getRecentOrders);

// Customer routes
router.get("/my-orders", getMyOrders);

// Shared/General routes
router.get("/:id", getOrder);
router.post("/", createOrder); // Admin/Customer can create

// Admin/Staff modify routes
router.put("/:id", authorize("admin", "staff"), updateOrder); // General edit
router.delete("/:id", authorize("admin", "staff"), deleteOrder); // Delete
router.patch("/:id/status", authorize("admin", "staff"), updateOrderStatus);
router.patch("/:id/payment", authorize("admin", "staff"), updatePaymentStatus);
router.post("/:id/refund", authorize("admin", "staff"), refundOrder);

export default router;
