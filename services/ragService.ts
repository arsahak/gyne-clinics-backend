import { ChatbotType } from "../modal/knowledgeBase";
import { generateEmbedding, generateChatCompletion, ChatMessage } from "./openaiService";
import { querySimilarVectors, VectorMetadata } from "./pineconeService";

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "gyneclinics-kb";

/**
 * System prompts for each chatbot type
 */
const systemPrompts: Record<ChatbotType, string> = {
  general: `You are a knowledgeable and empathetic General Gynaecology AI assistant for GyneClinics. 
Your role is to provide evidence-based information about:
- Menstrual health and disorders
- Pelvic pain and conditions
- Contraception options
- Fertility and reproductive health
- Screening and preventive care

IMPORTANT GUIDELINES:
- Always be empathetic and professional
- Use the provided context from our knowledge base to answer questions
- If you're unsure, recommend booking a consultation
- Never provide specific medical diagnoses
- Always include a disclaimer that this is guidance, not medical advice
- Encourage users to book appointments for personalized care`,

  urogynaecology: `You are a specialized Urogynaecology AI assistant for GyneClinics.
Your expertise includes:
- Urinary incontinence (stress, urge, mixed)
- Pelvic organ prolapse
- Bladder health and urodynamics
- Pelvic floor dysfunction
- Conservative and surgical treatments

IMPORTANT GUIDELINES:
- Be sensitive to potentially embarrassing topics
- Use the provided context from our knowledge base
- Explain medical terms in simple language
- Highlight that these conditions are common and treatable
- Never diagnose - always recommend professional assessment
- Mention our in-house urodynamics testing capabilities when relevant`,

  aesthetic: `You are a caring Aesthetic Gynaecology AI assistant for GyneClinics.
Your knowledge covers:
- Labiaplasty and intimate surgery
- Non-surgical treatments (laser, PRP, fillers)
- Recovery and expectations
- Safety and regulation
- Body confidence and wellness

IMPORTANT GUIDELINES:
- Be sensitive and non-judgmental
- Use the provided context from our knowledge base
- Clearly distinguish between surgical and non-surgical options
- Emphasize safety, regulation, and expert care
- Discuss recovery times realistically
- Never pressure - focus on education and empowerment`,

  menopause: `You are a supportive Menopause Health AI assistant for GyneClinics.
Your expertise includes:
- Perimenopause and menopause symptoms
- Bio-identical HRT (hormone replacement therapy)
- Lifestyle and holistic approaches
- Mood, cognitive, and physical changes
- BMS (British Menopause Society) guidelines

IMPORTANT GUIDELINES:
- Be warm and reassuring
- Use the provided context from our knowledge base
- Validate symptoms and experiences
- Explain HRT benefits and considerations clearly
- Mention our BMS-accredited specialists
- Emphasize personalized treatment plans
- Never make women feel their symptoms are "just part of aging"`,
};

/**
 * Generate response using RAG (Retrieval Augmented Generation)
 */
export const generateRAGResponse = async (
  userQuery: string,
  chatbotType: ChatbotType,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{
  response: string;
  sources: string[];
  relevantChunks: Array<{ text: string; fileName: string; score: number }>;
}> => {
  try {
    console.log(`🤖 Generating RAG response for: ${userQuery}`);

    // Step 1: Generate embedding for user query
    const queryEmbedding = await generateEmbedding(userQuery);

    // Step 2: Query Pinecone for similar vectors
    const namespace = `chatbot-${chatbotType}`;
    const similarVectors = await querySimilarVectors(
      PINECONE_INDEX_NAME,
      namespace,
      queryEmbedding,
      5, // Top 5 most relevant chunks
      { chatbotType } // Filter by chatbot type
    );

    console.log(`📚 Found ${similarVectors.length} relevant chunks`);

    // Step 3: Extract context from similar vectors
    const relevantChunks = similarVectors.map((match: any) => {
      const metadata = match.metadata as VectorMetadata;
      return {
        text: metadata.text,
        fileName: metadata.fileName,
        score: match.score || 0,
      };
    });

    // Step 4: Build context string
    const contextString = relevantChunks
      .map((chunk: { text: string; fileName: string; score: number }, idx: number) => 
        `[Context ${idx + 1}]: ${chunk.text}`
      )
      .join("\n\n");

    // Step 5: Get unique source files
    const sources: string[] = Array.from(
      new Set(relevantChunks.map((chunk: { text: string; fileName: string; score: number }) => chunk.fileName))
    );

    // Step 6: Build messages for OpenAI
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompts[chatbotType],
      },
      {
        role: "system",
        content: `Here is relevant information from our knowledge base:\n\n${contextString}\n\nUse this context to answer the user's question. If the context doesn't contain relevant information, use your general medical knowledge but always recommend consulting our specialists.`,
      },
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      });
    }

    // Add current user query
    messages.push({
      role: "user",
      content: userQuery,
    });

    // Step 7: Generate response using OpenAI
    const response = await generateChatCompletion(messages, {
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      maxTokens: 800,
    });

    console.log(`✅ Generated response successfully`);

    return {
      response,
      sources,
      relevantChunks,
    };
  } catch (error) {
    console.error("❌ Error generating RAG response:", error);
    throw error;
  }
};

/**
 * Generate a simple response without RAG (fallback)
 */
export const generateSimpleResponse = async (
  userQuery: string,
  chatbotType: ChatbotType
): Promise<string> => {
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompts[chatbotType],
      },
      {
        role: "user",
        content: userQuery,
      },
    ];

    const response = await generateChatCompletion(messages, {
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      maxTokens: 500,
    });

    return response;
  } catch (error) {
    console.error("❌ Error generating simple response:", error);
    throw error;
  }
};

export default {
  generateRAGResponse,
  generateSimpleResponse,
};
