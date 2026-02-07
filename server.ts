import cors from "cors";
import dotenv from "dotenv";
import express, { Application, NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import connectDB from "./config/db";
import admissionRoutes from "./routes/admission";
import attendanceRoutes from "./routes/attendance";
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import examRoutes from "./routes/exam";
import feeRoutes from "./routes/fee";
import portfolioRoutes from "./routes/portfolio";
import qrcodeRoutes from "./routes/qrcode";
import smsRoutes from "./routes/sms";
import userRoutes from "./routes/users";
import { getUploadsDir } from "./utils/paths";

// E-commerce routes
import categoryRoutes from "./routes/category";
import customerRoutes from "./routes/customer";
import orderRoutes from "./routes/order";
import productRoutes from "./routes/product";
import reviewRoutes from "./routes/review";

// AI Chatbot routes
import chatbotRoutes from "./routes/chatbot";
import knowledgeBaseRoutes from "./routes/knowledgeBase";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Database connection middleware for serverless environments
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    // Ensure database is connected before handling requests
    // This is important for serverless/Vercel where connections may be dropped
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error("Database connection middleware error:", error);
    next(error);
  }
});

// Serve static files from uploads directory
// Note: In serverless environments, static file serving may not work
// Consider using cloud storage (S3, Cloudinary, etc.) for production
try {
  const uploadsDir = getUploadsDir();
  app.use("/uploads", express.static(uploadsDir));
} catch (error) {
  console.warn(
    "Warning: Could not set up static file serving for uploads:",
    error
  );
}

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "E-commerce Dashboard API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check with database status
app.get("/health", (_req: Request, res: Response) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const isHealthy = mongoose.connection.readyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "OK" : "ERROR",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || "development",
  });
});

// API welcome route
app.get("/api", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to E-commerce Dashboard API",
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);

// Admission routes
app.use("/api/admission", admissionRoutes);

// Attendance routes
app.use("/api/attendance", attendanceRoutes);

// Exam routes
app.use("/api/exam", examRoutes);

// Fee routes
app.use("/api/fee", feeRoutes);

// QR code routes
app.use("/api/qrcode", qrcodeRoutes);

// SMS routes
app.use("/api/sms", smsRoutes);

// Portfolio routes
app.use("/api/portfolio", portfolioRoutes);

// User management routes
app.use("/api/users", userRoutes);

// E-commerce routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reviews", reviewRoutes);

// AI Chatbot routes
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Global Error Handler:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});

// Start server only if this file is run directly
if (require.main === module) {
  const startServer = async (): Promise<void> => {
    try {
      // Connect to database first
      await connectDB();

      // Start listening after database connection
      app.listen(PORT, () => {
        console.log("========================================");
        console.log("🚀 Server Started Successfully!");
        console.log("========================================");
        console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(`🔗 Server URL: http://localhost:${PORT}`);
        console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
        console.log(`⏰ Started At: ${new Date().toLocaleString()}`);
        console.log("========================================\n");
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  };

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err: Error) => {
    console.error("Unhandled Rejection:", err);
    process.exit(1);
  });

  // Start the server
  startServer();
}

// Export the Express app for Vercel serverless
export default app;
