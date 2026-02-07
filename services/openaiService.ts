import OpenAI from "openai";

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

export const initOpenAI = (): OpenAI => {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined in environment variables");
  }

  try {
    openaiClient = new OpenAI({
      apiKey: apiKey,
    });

    console.log("✅ OpenAI client initialized successfully");
    return openaiClient;
  } catch (error) {
    console.error("❌ Failed to initialize OpenAI:", error);
    throw error;
  }
};

/**
 * Generate embeddings for text using OpenAI
 * Model: text-embedding-3-small (configured to 1024 dimensions to match Pinecone index)
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const openai = initOpenAI();

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1024, // Match Pinecone index dimension
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error generating embedding:", error);
    throw error;
  }
};

/**
 * Generate embeddings for multiple texts in batch
 */
export const generateEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  try {
    const openai = initOpenAI();

    // OpenAI allows up to 2048 inputs per request
    const batchSize = 2048;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
        dimensions: 1024, // Match Pinecone index dimension
      });

      const embeddings = response.data.map((item) => item.embedding);
      allEmbeddings.push(...embeddings);

      console.log(
        `✅ Generated embeddings for batch ${i / batchSize + 1} (${batch.length} texts)`
      );
    }

    return allEmbeddings;
  } catch (error) {
    console.error("❌ Error generating embeddings:", error);
    throw error;
  }
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generate chat completion using OpenAI
 */
export const generateChatCompletion = async (
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> => {
  try {
    const openai = initOpenAI();

    const response = await openai.chat.completions.create({
      model: options?.model || "gpt-4-turbo-preview",
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000,
    });

    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("❌ Error generating chat completion:", error);
    throw error;
  }
};

/**
 * Count tokens in text (approximate)
 * GPT-4 uses roughly 1 token per 4 characters
 */
export const countTokens = (text: string): number => {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
};

export default {
  initOpenAI,
  generateEmbedding,
  generateEmbeddings,
  generateChatCompletion,
  countTokens,
};
