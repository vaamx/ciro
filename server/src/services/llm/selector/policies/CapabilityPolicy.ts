import { ModelInfo, ModelMetadata, ModelRequirements, ModelCapability } from '../../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from './policy.interface';

export class CapabilityPolicy implements IModelSelectionPolicy {
  name = 'CapabilityPolicy';

  evaluate(model: ModelInfo | ModelMetadata, requirements: ModelRequirements): PolicyEvaluationResult {
    let score = 0;
    let reasoning = 'Model does not meet all required capabilities.';
    // Capabilities are typically a hard requirement.
    // If a model doesn't support a required capability, it's usually not usable for the task.
    const isMandatory = true; 

    if (!requirements.capabilities || requirements.capabilities.length === 0) {
      // No specific capabilities required, so any model is fine from this policy's perspective.
      score = 1;
      reasoning = 'No specific capabilities required.';
    } else {
      const modelCapabilities = model.capabilities as ModelCapability[];
      if (!modelCapabilities || modelCapabilities.length === 0) {
        reasoning = 'Model has no listed capabilities, but capabilities are required.';
        // Score remains 0
      } else {
        const missingCapabilities = requirements.capabilities.filter(
          reqCap => !modelCapabilities.includes(reqCap)
        );

        if (missingCapabilities.length === 0) {
          score = 1; // Perfect match for capabilities
          reasoning = 'Model meets all required capabilities.';
        } else {
          // Score could be proportional to met capabilities, but for a mandatory policy,
          // any missing capability means failure (score 0 effectively, due to isMandatory).
          // However, for scoring visibility before filtering by isMandatory, we can calculate a partial score.
          const metCount = requirements.capabilities.length - missingCapabilities.length;
          score = metCount / requirements.capabilities.length;
          reasoning = `Model is missing capabilities: ${missingCapabilities.join(', ')}. Met ${metCount}/${requirements.capabilities.length}.`;
        }
      }
    }

    return {
      score,
      isMandatory,
      weight: 1.0, // Capability matching is crucial
      reasoning,
    };
  }
} 