import { ModelInfo, ModelMetadata, ModelRequirements } from '../../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from './policy.interface';

export class CostPolicy implements IModelSelectionPolicy {
  name = 'CostPolicy';

  evaluate(model: ModelInfo | ModelMetadata, requirements: ModelRequirements): PolicyEvaluationResult {
    let score = 0.5; // Default score if no pricing info or specific cost requirements.
    let reasoning = 'No specific cost constraints or model pricing info for a definitive score.';
    const isMandatory = false; 

    if ('pricing' in model && model.pricing) {
      const inputCostPerMillion = model.pricing.inputTokens;
      // const outputCostPerMillion = model.pricing.outputTokens;
      // For now, primarily focus on input cost for scoring when no maxCost is given.

      if (requirements.maxCost) {
        // User has specified a maxCost budget.
        if (inputCostPerMillion <= requirements.maxCost) {
          score = 1; // Perfect score if within budget.
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is within budget (${requirements.maxCost}/1M).`;
        } else {
          score = 0; // Zero score if over budget.
          reasoning = `Model input cost (${inputCostPerMillion}/1M) exceeds budget (${requirements.maxCost}/1M). Considered unsuitable.`;
        }
      } else {
        // No maxCost specified by user, score based on general cost-effectiveness tiers.
        if (inputCostPerMillion <= 0.2) {
          score = 1.0;
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is very low.`;
        } else if (inputCostPerMillion <= 0.6) {
          score = 0.8;
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is low.`;
        } else if (inputCostPerMillion <= 1.0) {
          score = 0.6;
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is moderate.`;
        } else if (inputCostPerMillion <= 2.0) {
          score = 0.4;
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is high.`;
        } else {
          score = 0.2;
          reasoning = `Model input cost (${inputCostPerMillion}/1M) is very high.`;
        }
      }
    }

    return {
      score,
      isMandatory, 
      weight: 0.8, // Cost is often an important factor
      reasoning,
    };
  }
} 