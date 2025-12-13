import { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server";
import connectDB from "../config/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Ensure database is connected before handling the request
    await connectDB();
  } catch (error) {
    console.error("Database connection failed in serverless handler:", error);
    // Continue to app, enabling it to potentially handle the error or at least log it
    // app might depend on DB, so this might fail later, but we logged it.
  }
  
  return app(req, res);
}