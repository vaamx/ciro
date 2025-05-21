export interface PreprocessedQuery {
  originalQuery: string;
  normalizedQuery: string;
  language?: string; // Optional, for future multilingual support
}

export interface HeuristicOutput {
  isAnalyticalIntent: boolean;
  isRetrievalIntent: boolean;
  requestsVisualization: boolean;
  mentionsDataset: boolean;
  mentionsCode: boolean; // Added for code mention detection
  analyticalScore: number; // Normalized 0-1
  retrievalScore: number; // Normalized 0-1
}

export type LLMClassification = 'direct_retrieval' | 'analytical_task' | 'clarification_needed';

export interface LLMClassificationOutput {
  classification: LLMClassification;
  confidence: number; // Normalized 0-1
  llmReasoning?: string;
}

export type RouterPath = 'direct_vector_rag' | 'analytical_rag' | 'user_clarification_needed';

export interface RouterDecision {
  chosenPath: RouterPath;
  confidence?: number;
  reasoning: string;
  details?: {
    heuristics: HeuristicOutput;
    llm_classification?: LLMClassificationOutput;
  };
} 