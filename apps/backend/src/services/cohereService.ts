import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const EMBEDDING_MODEL = 'embed-english-v3.0';

/**
 * Creates embeddings for document chunks.
 */
export const embedDocuments = async (texts: string[]): Promise<number[][]> => {
  const response = await cohere.embed({
    texts,
    model: EMBEDDING_MODEL,
    inputType: 'search_document',
  });

  // A runtime check to ensure the response format is correct.
  if (response && Array.isArray(response.embeddings)) {
    return response.embeddings as number[][];
  }

  throw new Error("Unexpected embedding response format from Cohere.");
};

/**
 * Creates a single embedding for a user query.
 */
export const embedQuery = async (text: string): Promise<number[]> => {
  const response = await cohere.embed({
    texts: [text],
    model: EMBEDDING_MODEL,
    inputType: 'search_query',
  });

  // A runtime check for the single query response.
  if (response && Array.isArray(response.embeddings) && response.embeddings.length > 0) {
    return response.embeddings[0] as number[];
  }

  throw new Error("Unexpected embedding response format from Cohere for query.");
};

/**
 * Rerank interface
 */
export interface RerankResult {
  index: number;
  relevanceScore: number;
  document: { id: string; text: string };
}

/**
 * Reranks documents using Cohere's rerank model.
 * This significantly improves precision by reordering results by relevance.
 * 
 * @param query - The user's query
 * @param documents - Array of documents with id and text
 * @param topK - Number of top results to return (default: 5)
 * @returns Reranked results with relevance scores
 */
export const rerankResults = async (
  query: string,
  documents: { id: string; text: string }[],
  topK: number = 5
): Promise<RerankResult[]> => {
  if (documents.length === 0) {
    return [];
  }

  // If fewer documents than topK, just return them all
  if (documents.length <= topK) {
    return documents.map((doc, index) => ({
      index,
      relevanceScore: 1 - (index * 0.1), // Synthetic scores
      document: doc,
    }));
  }

  try {
    const response = await cohere.rerank({
      query,
      documents: documents.map(d => d.text),
      model: 'rerank-english-v3.0',
      topN: topK,
    });

    if (response && response.results) {
      return response.results.map(result => ({
        index: result.index,
        relevanceScore: result.relevanceScore,
        document: documents[result.index],
      }));
    }

    throw new Error("Unexpected rerank response format from Cohere.");
  } catch (error) {
    console.error('[Cohere Rerank] Error:', error);
    // Fallback: return original order
    return documents.slice(0, topK).map((doc, index) => ({
      index,
      relevanceScore: 1 - (index * 0.1),
      document: doc,
    }));
  }
};