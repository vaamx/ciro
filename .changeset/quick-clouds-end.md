---
"ciro-project": minor
---

Implements Phase 4 (Tasks 4.2, 4.3, 4.4) of LLM integration, introducing an intelligent model selection engine to the LLMService.

This engine dynamically selects the most appropriate LLM provider and model based on task requirements, user preferences, and defined policies for cost, speed, and capabilities.

Key features and changes:
- **ModelSelectorService:** Core service for model selection logic.
- **Policy Engine:**
    - `CostPolicy`: Evaluates models based on pricing and user-defined `maxCost`.
    - `SpeedPolicy`: Evaluates models based on average latency and user-defined `latencyRequirement`.
    - `CapabilityPolicy`: Ensures models meet required capabilities (e.g., 'chat', 'vision', 'tool_calling').
    - Policies now use granular scoring for better differentiation.
- **ModelScorerService:** Scores models against active policies, considering user-configurable `policyWeights`.
- **`LLMService` Integration:**
    - `LLMService` now utilizes `ModelSelectorService` to pick models.
    - `analyzeRequirements` method in `LLMService` updated to derive comprehensive `ModelRequirements`.
- **User Configuration & Overrides:**
    - Users can specify `maxCost` in `LLMOptions`.
    - Users can provide `policyWeights` in `LLMOptions` to customize selection priorities.
- **Testing:**
    - Added `llm.service.model-selection.integration.spec.ts` with comprehensive tests for various selection scenarios (default, cost-restricted, speed-focused, preferred model, capability fallbacks).
    - All model selection integration tests are passing.

This provides a more robust, flexible, and cost-effective way to utilize LLMs by abstracting provider/model choice and optimizing for specific needs.
