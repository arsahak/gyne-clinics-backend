import pdf from "pdf-parse";
import * as fs from "fs";
import { countTokens } from "./openaiService";

export interface TextChunk {
  text: string;
  index: number;
  tokenCount: number;
}

/**
 * Extract text from PDF file
 */
export const extractTextFromPDF = async (
  filePath: string
): Promise<string> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    console.log(`✅ Extracted text from PDF: ${data.numpages} pages`);
    return data.text;
  } catch (error) {
    console.error("❌ Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
};

/**
 * Split text into chunks for embedding
 * Strategy: Split by sentences, keeping chunks around target token size
 */
export const chunkText = (
  text: string,
  options?: {
    maxTokens?: number;
    overlap?: number;
  }
): TextChunk[] => {
  const maxTokens = options?.maxTokens || 500;
  const overlap = options?.overlap || 50;

  // Clean text
  const cleanedText = text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
    .trim();

  // Split by sentences (basic approach)
  const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];

  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    // If adding this sentence would exceed max tokens, save current chunk
    if (
      currentTokenCount + sentenceTokens > maxTokens &&
      currentChunk.length > 0
    ) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokenCount,
      });

      // Start new chunk with overlap
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-overlap);
      currentChunk = overlapWords.join(" ") + " " + sentence;
      currentTokenCount = countTokens(currentChunk);
    } else {
      currentChunk += " " + sentence;
      currentTokenCount += sentenceTokens;
    }
  }

  // Add the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex++,
      tokenCount: currentTokenCount,
    });
  }

  console.log(`✅ Split text into ${chunks.length} chunks`);
  return chunks;
};

/**
 * Process PDF: Extract text and split into chunks
 */
export const processPDF = async (
  filePath: string,
  options?: {
    maxTokens?: number;
    overlap?: number;
  }
): Promise<TextChunk[]> => {
  try {
    // Extract text
    const text = await extractTextFromPDF(filePath);

    if (!text || text.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }

    // Split into chunks
    const chunks = chunkText(text, options);

    if (chunks.length === 0) {
      throw new Error("Failed to create text chunks from PDF");
    }

    return chunks;
  } catch (error) {
    console.error("❌ Error processing PDF:", error);
    throw error;
  }
};

/**
 * Get file info
 */
export const getFileInfo = (filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  } catch (error) {
    console.error("❌ Error getting file info:", error);
    throw error;
  }
};

export default {
  extractTextFromPDF,
  chunkText,
  processPDF,
  getFileInfo,
};
