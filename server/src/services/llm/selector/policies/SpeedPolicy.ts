import { ModelInfo, ModelMetadata, ModelRequirements, LatencyRequirement } from '../../types/llm-types';
import { IModelSelectionPolicy, PolicyEvaluationResult } from './policy.interface';

// Define thresholds for latency requirements (in milliseconds for averageLatency)
const LATENCY_THRESHOLDS: Record<LatencyRequirement, number> = {
  low: 500,    // e.g., interactive chat, real-time suggestions
  medium: 2000,  // e.g., document summarization, non-critical background tasks
  high: 5000,   // e.g., complex analysis, batch processing where latency is less critical
};

export class SpeedPolicy implements IModelSelectionPolicy {
  name = 'SpeedPolicy';

  evaluate(model: ModelInfo | ModelMetadata, requirements: ModelRequirements): PolicyEvaluationResult {
    let score = 0.5; // Default score
    let reasoning = 'No specific latency requirements or performance data for a definitive score.';
    const isMandatory = false; 
    const modelPerformance = 'performance' in model ? model.performance : undefined;

    if (requirements.latencyRequirement && modelPerformance?.averageLatency !== undefined) {
      const requiredMaxLatency = LATENCY_THRESHOLDS[requirements.latencyRequirement];
      const actualLatency = modelPerformance.averageLatency;

      if (actualLatency <= requiredMaxLatency) {
        // Model meets the basic requirement. Now, score more granularly.
        // Higher score for faster models (lower latency).
        // Normalize score based on how far below the max required latency it is.
        // A model at the threshold gets a base score (e.g., 0.6), a very fast model gets closer to 1.
        score = 0.6 + 0.4 * (1 - (actualLatency / requiredMaxLatency));
        // Ensure score is capped at 1, e.g. if actualLatency is 0 or very small.
        score = Math.min(score, 1.0); 
        reasoning = `Model latency (${actualLatency}ms) is within requirement (${requirements.latencyRequirement} <= ${requiredMaxLatency}ms). Score reflects relative speed.`;
      } else {
        // Model exceeds requirement. Score proportionally how much it missed by.
        // E.g. if twice as slow, score = 0.1. If 1.1x slow, score ~0.4
        // This gives some score rather than 0, as it might still be usable if other factors are strong.
        // Max out how bad the score can be, e.g. don't go below 0.1 if it's just slightly over.
        const excessRatio = actualLatency / requiredMaxLatency; // e.g., 1.5 if 50% over
        score = Math.max(0.1, 0.5 / excessRatio); //  Example: 0.5 / 1.5 = 0.33.  0.5 / 2 = 0.25
        reasoning = `Model latency (${actualLatency}ms) exceeds requirement (${requirements.latencyRequirement} > ${requiredMaxLatency}ms). Score penalized.`;
      }
    } else if (requirements.latencyRequirement) {
      score = 0.1; // Model has no performance data, but latency is required. Give a low score.
      reasoning = 'Latency requirement specified, but model has no performance data.';
    }

    return {
      score,
      isMandatory,
      weight: 0.7, // Speed is often important
      reasoning,
    };
  }
} 