import express from "express";
import {
  addCustomerAddress,
  createCustomer,
  deleteCustomer,
  deleteCustomerAddress,
  getCustomer,
  getCustomerOrders,
  getCustomers,
  getCustomerStats,
  updateCustomer,
  updateCustomerAddress,
} from "../controller/customerController";
import { authenticate, authorize } from "../middleware/auth";

const router = express.Router();

// All routes are protected and admin/staff only
router.use(authenticate);
router.use(authorize("admin", "staff"));

router.get("/", getCustomers);
router.get("/stats", getCustomerStats);
router.get("/:id", getCustomer);
router.get("/:id/orders", getCustomerOrders);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

// Address management
router.post("/:id/addresses", addCustomerAddress);
router.put("/:id/addresses/:addressId", updateCustomerAddress);
router.delete("/:id/addresses/:addressId", deleteCustomerAddress);

export default router;
