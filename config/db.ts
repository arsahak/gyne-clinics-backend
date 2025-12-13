import mongoose from "mongoose";

// Mongoose connection caching for serverless
let isConnected = false;

const connectDB = async (): Promise<void> => {
  // If already connected, reuse connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  try {
    // Support both variable names for flexibility
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    const conn = await mongoose.connect(mongoURI, {
      // Optimized for serverless/Vercel deployment
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain at least 1 connection
      maxIdleTimeMS: 10000, // Close connections after 10s of inactivity
    });

    isConnected = true;
    console.log("========================================");
    console.log("✅ Database Connected Successfully!");
    console.log("========================================");
    console.log(`🔗 Host: ${conn.connection.host}`);
    console.log(`⏰ Connected At: ${new Date().toLocaleString()}`);
    console.log("========================================\n");
  } catch (error) {
    console.error("========================================");
    console.error("❌ Database Connection Error:");
    console.error("========================================");
    console.error(error instanceof Error ? error.message : "Unknown error");
    console.error("========================================\n");
    isConnected = false;

    // Don't exit in production (serverless can't handle process.exit)
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    } else {
      // In production, throw the error so the serverless function can report it
      throw error;
    }
  }
};

// Handle connection events
mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  isConnected = false;
  console.error("❌ MongoDB connection error:", err);
});

export default connectDB;