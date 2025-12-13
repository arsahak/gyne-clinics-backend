import express from "express";
import { getEcommerceStats } from "../controller/dashboardController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// Protect all routes
router.use(authenticate);

// @route   GET /api/dashboard/overview
// @desc    Get e-commerce dashboard statistics
// @access  Private
router.get("/overview", getEcommerceStats);

export default router;