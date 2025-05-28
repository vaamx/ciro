import { ModelRequirements, ModelInfo, ModelMetadata } from '../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from './policies/policy.interface';
import { IModelScorer, ModelScore } from './scoring/scorer.interface';

// Re-export for convenience if needed, or they can be imported directly from their files
export { IModelSelectionPolicy, PolicyEvaluationResult } from './policies/policy.interface';
export { IModelScorer, ModelScore } from './scoring/scorer.interface';

export interface IModelSelectorService {
  selectBestModel(
    availableModels: (ModelInfo | ModelMetadata)[],
    requirements: ModelRequirements,
    preferredModelId?: string 
  ): Promise<ModelInfo | ModelMetadata | null>;
}

export const MODEL_SELECTOR_SERVICE = 'MODEL_SELECTOR_SERVICE'; 