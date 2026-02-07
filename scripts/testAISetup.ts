import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const testAISetup = async () => {
  console.log("========================================");
  console.log("🧪 Testing AI Chatbot Configuration");
  console.log("========================================\n");

  let hasErrors = false;

  // Test 1: Check environment variables
  console.log("1️⃣  Checking environment variables...");
  const requiredVars = [
    "OPENAI_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "MONGO_URI",
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName} is set`);
    } else {
      console.log(`   ❌ ${varName} is MISSING`);
      hasErrors = true;
    }
  }
  console.log("");

  if (hasErrors) {
    console.log("❌ Please set all required environment variables in .env file");
    process.exit(1);
  }

  // Test 2: Test OpenAI connection
  console.log("2️⃣  Testing OpenAI connection...");
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test embedding generation
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "This is a test",
    });

    if (embeddingResponse.data[0].embedding.length === 1536) {
      console.log("   ✅ OpenAI API is working");
      console.log(`   ✅ Embedding dimension: ${embeddingResponse.data[0].embedding.length}`);
    } else {
      console.log("   ⚠️  Unexpected embedding dimension");
    }

    // Test chat completion
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say 'test successful' if you can read this" }],
      max_tokens: 10,
    });

    if (chatResponse.choices[0]?.message?.content) {
      console.log("   ✅ Chat completion is working");
      console.log(`   ✅ Response: ${chatResponse.choices[0].message.content}`);
    }
  } catch (error: any) {
    console.log(`   ❌ OpenAI Error: ${error.message}`);
    hasErrors = true;
  }
  console.log("");

  // Test 3: Test Pinecone connection
  console.log("3️⃣  Testing Pinecone connection...");
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pinecone.index(indexName);

    // Get index stats
    const stats = await index.describeIndexStats();
    console.log("   ✅ Pinecone API is working");
    console.log(`   ✅ Index: ${indexName}`);
    console.log(`   ✅ Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   ✅ Dimension: ${stats.dimension || "N/A"}`);

    if (stats.dimension !== 1536) {
      console.log("   ⚠️  WARNING: Index dimension should be 1536 for OpenAI embeddings");
      console.log("   ⚠️  Please recreate the index with dimension: 1536");
    }
  } catch (error: any) {
    console.log(`   ❌ Pinecone Error: ${error.message}`);
    console.log("   ⚠️  Make sure you've created an index with:");
    console.log("      - Name: " + process.env.PINECONE_INDEX_NAME);
    console.log("      - Dimensions: 1536");
    console.log("      - Metric: cosine");
    hasErrors = true;
  }
  console.log("");

  // Test 4: Check MongoDB connection (optional, not critical for AI)
  console.log("4️⃣  MongoDB configuration...");
  if (process.env.MONGO_URI) {
    console.log("   ✅ MONGO_URI is configured");
    console.log("   ℹ️  Run 'npm run dev' to test MongoDB connection");
  }
  console.log("");

  // Summary
  console.log("========================================");
  if (hasErrors) {
    console.log("❌ Configuration test FAILED");
    console.log("Please fix the errors above and run this test again.");
  } else {
    console.log("✅ All tests PASSED!");
    console.log("Your AI chatbot is ready to use.");
    console.log("\nNext steps:");
    console.log("1. Start the backend server: npm run dev");
    console.log("2. Upload PDF documents via admin panel");
    console.log("3. Test the chatbot!");
  }
  console.log("========================================");

  process.exit(hasErrors ? 1 : 0);
};

// Run tests
testAISetup().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
