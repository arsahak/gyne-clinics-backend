import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export const initPinecone = async (): Promise<Pinecone> => {
  if (pineconeClient) {
    return pineconeClient;
  }

  const apiKey = process.env.PINECONE_API_KEY;
  
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is not defined in environment variables");
  }

  try {
    pineconeClient = new Pinecone({
      apiKey: apiKey,
    });

    console.log("✅ Pinecone client initialized successfully");
    return pineconeClient;
  } catch (error) {
    console.error("❌ Failed to initialize Pinecone:", error);
    throw error;
  }
};

export const getPineconeIndex = async (indexName: string) => {
  const pinecone = await initPinecone();
  return pinecone.index(indexName);
};

export interface VectorMetadata extends RecordMetadata {
  text: string;
  fileName: string;
  chatbotType: string;
  chunkIndex: number;
  documentId: string;
  uploadedAt: string;
}

/**
 * Upsert vectors to Pinecone
 */
export const upsertVectors = async (
  indexName: string,
  namespace: string,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: VectorMetadata;
  }>
) => {
  try {
    const index = await getPineconeIndex(indexName);
    
    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace(namespace).upsert(batch);
      console.log(`✅ Upserted batch ${i / batchSize + 1} (${batch.length} vectors)`);
    }

    return { success: true, count: vectors.length };
  } catch (error) {
    console.error("❌ Error upserting vectors:", error);
    throw error;
  }
};

/**
 * Query similar vectors from Pinecone
 */
export const querySimilarVectors = async (
  indexName: string,
  namespace: string,
  queryVector: number[],
  topK: number = 5,
  filter?: Record<string, any>
) => {
  try {
    const index = await getPineconeIndex(indexName);
    
    const queryResponse = await index.namespace(namespace).query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter,
    });

    return queryResponse.matches || [];
  } catch (error) {
    console.error("❌ Error querying vectors:", error);
    throw error;
  }
};

/**
 * Delete vectors from Pinecone by namespace
 */
export const deleteNamespace = async (
  indexName: string,
  namespace: string
) => {
  try {
    const index = await getPineconeIndex(indexName);
    await index.namespace(namespace).deleteAll();
    console.log(`✅ Deleted all vectors in namespace: ${namespace}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting namespace:", error);
    throw error;
  }
};

/**
 * Get index stats
 */
export const getIndexStats = async (indexName: string) => {
  try {
    const index = await getPineconeIndex(indexName);
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error("❌ Error getting index stats:", error);
    throw error;
  }
};

export default {
  initPinecone,
  getPineconeIndex,
  upsertVectors,
  querySimilarVectors,
  deleteNamespace,
  getIndexStats,
};
