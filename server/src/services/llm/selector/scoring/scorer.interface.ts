import { ModelRequirements, ModelInfo, ModelMetadata } from '../../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from '../policies/policy.interface';

export interface ModelScore {
  model: ModelInfo | ModelMetadata;
  overallScore: number;
  policyScores: Record<string, PolicyEvaluationResult>; // Scores from each policy, keyed by policy name
  isViable: boolean; // Is the model a candidate after mandatory policies and overall score threshold?
  reasoning?: string[]; // Aggregate reasoning for viability or non-viability
}

export interface IModelScorer {
  /**
   * Scores a single model against a set of requirements using multiple policies.
   * @param model The model to score.
   * @param requirements The requirements the model must meet.
   * @param policies An array of policies to evaluate the model against.
   * @returns A Promise resolving to the ModelScore.
   */
  scoreModel(
    model: ModelInfo | ModelMetadata,
    requirements: ModelRequirements,
    policies: IModelSelectionPolicy[]
  ): Promise<ModelScore>;
} 