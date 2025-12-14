import express from "express";
import {
  addCurrentCustomerAddress,
  addCustomerAddress,
  createCustomer,
  customerSignin,
  customerSignup,
  deleteCurrentCustomerAddress,
  deleteCustomer,
  deleteCustomerAddress,
  forgotPassword,
  getCurrentCustomer,
  getCustomer,
  getCustomerOrders,
  getCustomers,
  getCustomerStats,
  resetPassword,
  updateCurrentCustomer,
  updateCurrentCustomerAddress,
  updateCustomer,
  updateCustomerAddress,
  updatePassword,
} from "../controller/customerController";
import { authenticate, authorize } from "../middleware/auth";

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Customer Authentication
router.post("/signup", customerSignup);
router.post("/signin", customerSignin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ============================================
// AUTHENTICATED CUSTOMER ROUTES
// ============================================

// Customer Profile Management
router.get("/me", authenticate, getCurrentCustomer);
router.put("/me", authenticate, updateCurrentCustomer);
router.put("/me/password", authenticate, updatePassword);

// Customer Address Management
router.post("/me/addresses", authenticate, addCurrentCustomerAddress);
router.put(
  "/me/addresses/:addressId",
  authenticate,
  updateCurrentCustomerAddress
);
router.delete(
  "/me/addresses/:addressId",
  authenticate,
  deleteCurrentCustomerAddress
);

// ============================================
// ADMIN/STAFF ROUTES (Protected)
// ============================================

// All admin routes require authentication and authorization
router.use(authenticate);
router.use(authorize("admin", "staff"));

// Customer Management
router.get("/", getCustomers);
router.get("/stats", getCustomerStats);
router.get("/:id", getCustomer);
router.get("/:id/orders", getCustomerOrders);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

// Address Management (Admin)
router.post("/:id/addresses", addCustomerAddress);
router.put("/:id/addresses/:addressId", updateCustomerAddress);
router.delete("/:id/addresses/:addressId", deleteCustomerAddress);

export default router;
