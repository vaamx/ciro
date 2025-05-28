import { Injectable, Logger } from '@nestjs/common';
import { ModelInfo, ModelMetadata, ModelRequirements } from '../../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from '../policies/policy.interface';
import { IModelScorer, ModelScore } from './scorer.interface';

export const MODEL_SCORER_SERVICE = 'MODEL_SCORER_SERVICE';

@Injectable()
export class ModelScorerService implements IModelScorer {
  private readonly logger = new Logger(ModelScorerService.name);

  async scoreModel(
    model: ModelInfo | ModelMetadata,
    requirements: ModelRequirements,
    policies: IModelSelectionPolicy[]
  ): Promise<ModelScore> {
    this.logger.debug(`Scoring model ${model.id} against ${policies.length} policies.`);
    let overallScore = 0;
    let totalWeight = 0;
    const policyScores: Record<string, PolicyEvaluationResult> = {};
    const reasoning: string[] = [];
    let isViable = true; // Assume viable until a mandatory policy fails

    for (const policy of policies) {
      const evaluationResult = policy.evaluate(model, requirements);
      policyScores[policy.name] = evaluationResult;
      
      let currentPolicyReasoning = `${policy.name}: ${evaluationResult.reasoning} (Score: ${evaluationResult.score.toFixed(2)}`;

      let weight = evaluationResult.weight || 1; // Policy's default weight
      if (requirements.policyWeights && requirements.policyWeights[policy.name] !== undefined) {
        weight = requirements.policyWeights[policy.name];
        currentPolicyReasoning += `, UserWeight: ${weight}`;
      } else {
        currentPolicyReasoning += `, DefaultWeight: ${weight}`;
      }
      currentPolicyReasoning += ')';
      reasoning.push(currentPolicyReasoning);

      if (evaluationResult.isMandatory && evaluationResult.score < 0.5) { // Threshold for mandatory policies
        isViable = false;
        reasoning.push(`Model disqualified by mandatory policy: ${policy.name}.`);
        // No need to calculate weighted score if a mandatory policy fails hard
        // but we continue to gather all policy results for complete feedback.
      }

      // Only include in weighted average if the model is still considered viable from this policy
      // or if the policy is not mandatory. This prevents failed mandatory policies from skewing score if we decide to use it.
      // However, a simpler approach is to sum all weighted scores and then check isViable.
      overallScore += evaluationResult.score * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      overallScore = overallScore / totalWeight;
    } else {
      overallScore = 0; // Avoid division by zero if no policies or all have zero weight
    }
    
    // Final viability check based on overall score threshold if needed, e.g., overallScore > 0.2
    // For now, viability is primarily determined by mandatory policies.
    if (isViable && overallScore < 0.2 && policies.length > 0) { // Example threshold for overall score
        // isViable = false; // Uncomment if a minimum overall score is also a viability criterion
        // reasoning.push(`Model overall score (${overallScore.toFixed(2)}) is below minimum threshold (0.2).`);
    }

    this.logger.debug(
      `Model ${model.id} scoring complete. Overall: ${overallScore.toFixed(2)}, Viable: ${isViable}`
    );

    return {
      model,
      overallScore,
      policyScores,
      isViable,
      reasoning,
    };
  }
} 