import { ModelRequirements, ModelInfo, ModelMetadata } from '../../types/llm-types';

export interface IModelSelectionPolicy {
  /** Unique name for the policy */
  name: string;
  /** 
   * Evaluates a model against given requirements based on this policy.
   * @returns A result indicating the model's suitability according to this policy.
   */
  evaluate(model: ModelInfo | ModelMetadata, requirements: ModelRequirements): PolicyEvaluationResult;
}

export interface PolicyEvaluationResult {
  /** A score from 0 to 1, where 1 is a perfect match for this policy. */
  score: number;
  /** If true, this policy is a hard requirement. A score below a certain threshold (e.g., < 0.5 or 0) disqualifies the model. */
  isMandatory?: boolean;
  /** The weight of this policy's score in the overall model score calculation (e.g., 0.1 to 1.0). */
  weight?: number;
  /** An optional explanation for the score, useful for debugging or providing insights. */
  reasoning?: string;
} 