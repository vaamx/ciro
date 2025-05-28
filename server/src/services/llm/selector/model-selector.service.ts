import { Injectable, Logger, Inject } from '@nestjs/common';
import { ModelRequirements, ModelInfo, ModelMetadata } from '../types/llm-types';
import {
  IModelSelectorService,
  IModelScorer,
  // IModelSelectionPolicy, // No longer directly used here, policies are instantiated
  MODEL_SELECTOR_SERVICE
} from './model-selector.interface';
import { ModelScorerService, MODEL_SCORER_SERVICE } from './scoring/ModelScorerService'; // Corrected path
import { CostPolicy } from './policies/CostPolicy';
import { SpeedPolicy } from './policies/SpeedPolicy';
import { CapabilityPolicy } from './policies/CapabilityPolicy';
import { ModelScore } from './scoring/scorer.interface';

@Injectable()
export class ModelSelectorService implements IModelSelectorService {
  private readonly logger = new Logger(ModelSelectorService.name);
  private readonly policies;

  constructor(
    @Inject(MODEL_SCORER_SERVICE) private readonly modelScorer: IModelScorer,
  ) {
    // Instantiate policies here. In a larger system, these might be injected or managed by a registry.
    this.policies = [
      new CostPolicy(),
      new SpeedPolicy(),
      new CapabilityPolicy(),
    ];
  }

  async selectBestModel(
    availableModels: (ModelInfo | ModelMetadata)[],
    requirements: ModelRequirements,
    preferredModelId?: string
  ): Promise<ModelInfo | ModelMetadata | null> {
    this.logger.debug(
      `Selecting best model. Requirements: ${JSON.stringify(requirements)}, Preferred: ${preferredModelId || 'none'}, Available: ${availableModels.length}`
    );

    if (availableModels.length === 0) {
      this.logger.warn('No models available for selection.');
      return null;
    }

    // 1. Handle preferred model if specified and valid
    if (preferredModelId) {
      const preferredModel = availableModels.find(m => m.id === preferredModelId);
      if (preferredModel) {
        // Use a quick check with CapabilityPolicy (as it's mandatory)
        const capabilityPolicy = new CapabilityPolicy(); 
        const capabilityEval = capabilityPolicy.evaluate(preferredModel, requirements);
        
        // For a preferred model to be used directly, it MUST perfectly match all mandatory capabilities.
        // A score of 1 from CapabilityPolicy indicates all required capabilities are met.
        if (capabilityEval.score === 1) { 
          this.logger.log(`Using preferred model: ${preferredModelId} as it meets all mandatory capabilities.`);
          return preferredModel;
        } else {
          this.logger.warn(
            `Preferred model ${preferredModelId} does not meet all mandatory capabilities (Score: ${capabilityEval.score.toFixed(2)}, Reasoning: ${capabilityEval.reasoning}). Proceeding with dynamic selection.`
          );
        }
      } else {
        this.logger.warn(
          `Preferred model ${preferredModelId} not found in available models. Proceeding with dynamic selection.`
        );
      }
    }

    // 2. Score all available models against requirements using policies
    const scoredModels: ModelScore[] = [];
    for (const model of availableModels) {
      const score = await this.modelScorer.scoreModel(model, requirements, this.policies);
      scoredModels.push(score);
      this.logger.verbose(`Model ${model.id} scored: Overall ${score.overallScore.toFixed(2)}, Viable: ${score.isViable}. Reasons: ${score.reasoning?.join('; ')}`);
    }

    // 3. Filter for viable models and select the best one
    const viableModels = scoredModels.filter(sm => sm.isViable);

    if (viableModels.length === 0) {
      this.logger.warn('No viable models found after scoring. Review policy evaluations.');
      // Log details of all scored models for debugging when no viable models are found
      this.logger.warn('--- All Scored Models (No Viable Found) ---');
      scoredModels.forEach(sm => {
        this.logger.warn(
            `ModelSelectorService - Debug - Model ${sm.model.id}: Viable=${sm.isViable}, OverallScore=${sm.overallScore.toFixed(3)}, PolicyScores=${JSON.stringify(sm.policyScores, null, 2)}, Reasoning: ${sm.reasoning?.join('; ')}`
        );
      });
      this.logger.warn('------------------------------------------');
      return null;
    }

    // Sort viable models by overall score in descending order
    viableModels.sort((a, b) => b.overallScore - a.overallScore);

    const bestModel = viableModels[0].model;
    this.logger.log(
      `Selected best model: ${bestModel.id} with score ${viableModels[0].overallScore.toFixed(2)}`
    );
    return bestModel;
  }
} 