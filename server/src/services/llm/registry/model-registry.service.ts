/**
 * Model Registry Service
 * Manages all available models and their metadata across providers
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ModelMetadata,
  ModelInfo,
  ModelCapability,
  ModelRequirements,
  LLMError
} from '../types/llm-types';

@Injectable()
export class ModelRegistry {
  private readonly logger = new Logger(ModelRegistry.name);
  private readonly models = new Map<string, ModelMetadata>();
  private readonly providerModels = new Map<string, Set<string>>();
  private readonly capabilityIndex = new Map<ModelCapability, Set<string>>();

  constructor(private readonly configService: ConfigService) {
    this.initializeDefaultModels();
  }

  /**
   * Register a model in the registry
   */
  registerModel(model: ModelMetadata): void {
    this.logger.debug(`Registering model: ${model.id} from provider: ${model.provider}`);
    
    // Validate model metadata
    this.validateModelMetadata(model);
    
    // Store model
    this.models.set(model.id, model);
    
    // Update provider index
    if (!this.providerModels.has(model.provider)) {
      this.providerModels.set(model.provider, new Set());
    }
    this.providerModels.get(model.provider)!.add(model.id);
    
    // Update capability index
    model.capabilities.forEach(capability => {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(model.id);
    });
    
    this.logger.log(`Model ${model.id} registered successfully`);
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models
   */
  getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): ModelMetadata[] {
    const modelIds = this.providerModels.get(provider);
    if (!modelIds) return [];
    
    return Array.from(modelIds)
      .map(id => this.models.get(id))
      .filter((model): model is ModelMetadata => model !== undefined);
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: ModelCapability): ModelMetadata[] {
    const modelIds = this.capabilityIndex.get(capability);
    if (!modelIds) return [];
    
    return Array.from(modelIds)
      .map(id => this.models.get(id))
      .filter((model): model is ModelMetadata => model !== undefined);
  }

  /**
   * Get models that meet specific requirements
   */
  getModelsByRequirements(requirements: ModelRequirements): ModelMetadata[] {
    let candidates = this.getAllModels();

    // Filter by capabilities
    if (requirements.capabilities.length > 0) {
      candidates = candidates.filter(model =>
        requirements.capabilities.every(cap => model.capabilities.includes(cap))
      );
    }

    // Filter by context window
    candidates = candidates.filter(model =>
      model.contextWindow >= requirements.contextWindow
    );

    // Filter by provider preference
    if (requirements.preferredProvider) {
      candidates = candidates.filter(model =>
        model.provider === requirements.preferredProvider
      );
    }

    // Filter by privacy level (basic implementation)
    if (requirements.privacyLevel === 'restricted') {
      // Only allow local/on-prem models for restricted data
      candidates = candidates.filter(model =>
        model.provider === 'ollama' || model.id.includes('local')
      );
    }

    // Filter by availability
    candidates = candidates.filter(model =>
      model.availability.status === 'available' || model.availability.status === 'beta'
    );

    return candidates;
  }

  /**
   * Select the best model for given requirements
   */
  selectBestModel(requirements: ModelRequirements): ModelMetadata | null {
    const candidates = this.getModelsByRequirements(requirements);
    
    if (candidates.length === 0) {
      this.logger.warn('No models found matching requirements', requirements);
      return null;
    }

    // Score and rank candidates
    const scored = candidates.map(model => ({
      model,
      score: this.calculateModelScore(model, requirements)
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0].model;
    this.logger.debug(`Selected model ${selected.id} with score ${scored[0].score}`);
    
    return selected;
  }

  /**
   * Get lightweight model info for API responses
   */
  getModelInfo(modelId: string): ModelInfo | undefined {
    const model = this.models.get(modelId);
    if (!model) return undefined;

    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      capabilities: model.capabilities,
      contextWindow: model.contextWindow,
      status: model.availability.status
    };
  }

  /**
   * Get all model info
   */
  getAllModelInfo(): ModelInfo[] {
    return Array.from(this.models.values()).map(model => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      capabilities: model.capabilities,
      contextWindow: model.contextWindow,
      status: model.availability.status
    }));
  }

  /**
   * Update model metadata
   */
  updateModel(modelId: string, updates: Partial<ModelMetadata>): void {
    const existing = this.models.get(modelId);
    if (!existing) {
      throw new LLMError(`Model ${modelId} not found`, 'MODEL_NOT_FOUND');
    }

    const updated = { ...existing, ...updates };
    this.validateModelMetadata(updated);
    
    // Re-register the updated model
    this.models.set(modelId, updated);
    this.logger.log(`Model ${modelId} updated`);
  }

  /**
   * Remove a model from the registry
   */
  removeModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (!model) return;

    // Remove from main registry
    this.models.delete(modelId);

    // Remove from provider index
    const providerSet = this.providerModels.get(model.provider);
    if (providerSet) {
      providerSet.delete(modelId);
      if (providerSet.size === 0) {
        this.providerModels.delete(model.provider);
      }
    }

    // Remove from capability index
    model.capabilities.forEach(capability => {
      const capabilitySet = this.capabilityIndex.get(capability);
      if (capabilitySet) {
        capabilitySet.delete(modelId);
        if (capabilitySet.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    });

    this.logger.log(`Model ${modelId} removed from registry`);
  }

  /**
   * Calculate a score for a model based on requirements
   */
  private calculateModelScore(model: ModelMetadata, requirements: ModelRequirements): number {
    let score = 0;

    // Base score for availability
    switch (model.availability.status) {
      case 'available':
        score += 100;
        break;
      case 'beta':
        score += 80;
        break;
      case 'limited':
        score += 60;
        break;
      case 'deprecated':
        score += 20;
        break;
    }

    // Cost optimization (higher score for cheaper models when appropriate)
    if (requirements.taskComplexity === 'simple') {
      const costScore = Math.max(0, 100 - (model.pricing.inputTokens / 10));
      score += costScore * 0.3;
    }

    // Performance optimization
    if (requirements.latencyRequirement === 'low') {
      const latencyScore = Math.max(0, 100 - (model.performance.averageLatency / 100));
      score += latencyScore * 0.2;
    }

    // Quality optimization for complex tasks
    if (requirements.taskComplexity === 'complex') {
      if (model.capabilities.includes('advanced_reasoning')) {
        score += 50;
      }
      if (model.contextWindow > 100000) {
        score += 30;
      }
    }

    // Context window bonus
    if (model.contextWindow >= requirements.contextWindow * 2) {
      score += 20; // Bonus for having plenty of context space
    }

    // Provider preference
    if (requirements.preferredProvider === model.provider) {
      score += 25;
    }

    // Task-specific bonuses
    switch (requirements.taskType) {
      case 'code_generation':
        if (model.capabilities.includes('code_generation')) score += 40;
        break;
      case 'vision':
        if (model.capabilities.includes('vision')) score += 40;
        break;
      case 'embedding':
        if (model.capabilities.includes('embedding')) score += 40;
        break;
    }

    return score;
  }

  /**
   * Validate model metadata
   */
  private validateModelMetadata(model: ModelMetadata): void {
    if (!model.id || !model.provider || !model.name) {
      throw new LLMError('Model must have id, provider, and name', 'INVALID_MODEL_METADATA');
    }

    if (model.contextWindow <= 0) {
      throw new LLMError('Model context window must be positive', 'INVALID_MODEL_METADATA');
    }

    if (model.capabilities.length === 0) {
      throw new LLMError('Model must have at least one capability', 'INVALID_MODEL_METADATA');
    }

    if (model.pricing.inputTokens < 0 || model.pricing.outputTokens < 0) {
      throw new LLMError('Model pricing cannot be negative', 'INVALID_MODEL_METADATA');
    }
  }

  /**
   * Initialize default models (OpenAI models to start)
   */
  private initializeDefaultModels(): void {
    // OpenAI GPT-4o models
    this.registerModel({
      id: 'gpt-4o',
      provider: 'openai',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      description: 'Most advanced GPT-4 model with vision capabilities',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming', 'advanced_reasoning'],
      pricing: {
        inputTokens: 2.50, // per 1M tokens
        outputTokens: 10.00
      },
      performance: {
        averageLatency: 2000,
        tokensPerSecond: 50
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 500,
        tokensPerMinute: 30000
      }
    });

    this.registerModel({
      id: 'gpt-4o-mini',
      provider: 'openai',
      name: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      description: 'Faster, more cost-effective version of GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming'],
      pricing: {
        inputTokens: 0.15,
        outputTokens: 0.60
      },
      performance: {
        averageLatency: 800,
        tokensPerSecond: 100
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 200000
      }
    });

    // OpenAI o1 models
    this.registerModel({
      id: 'o1-preview',
      provider: 'openai',
      name: 'o1-preview',
      displayName: 'o1-preview',
      description: 'Advanced reasoning model for complex problems',
      contextWindow: 128000,
      maxOutputTokens: 32768,
      capabilities: ['chat', 'advanced_reasoning', 'complex_reasoning'],
      pricing: {
        inputTokens: 15.00,
        outputTokens: 60.00
      },
      performance: {
        averageLatency: 10000, // Slower due to reasoning
        tokensPerSecond: 20
      },
      availability: {
        regions: ['us'],
        status: 'beta'
      },
      limits: {
        requestsPerMinute: 20,
        tokensPerMinute: 20000
      }
    });

    this.registerModel({
      id: 'o1-mini',
      provider: 'openai',
      name: 'o1-mini',
      displayName: 'o1-mini',
      description: 'Faster reasoning model for STEM problems',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      capabilities: ['chat', 'advanced_reasoning', 'code_generation'],
      pricing: {
        inputTokens: 3.00,
        outputTokens: 12.00
      },
      performance: {
        averageLatency: 5000,
        tokensPerSecond: 30
      },
      availability: {
        regions: ['us'],
        status: 'beta'
      },
      limits: {
        requestsPerMinute: 50,
        tokensPerMinute: 50000
      }
    });

    // OpenAI embedding models
    this.registerModel({
      id: 'text-embedding-3-large',
      provider: 'openai',
      name: 'text-embedding-3-large',
      displayName: 'Text Embedding 3 Large',
      description: 'Most capable embedding model',
      contextWindow: 8191,
      maxOutputTokens: 0,
      capabilities: ['embedding'],
      pricing: {
        inputTokens: 0.13,
        outputTokens: 0
      },
      performance: {
        averageLatency: 200,
        tokensPerSecond: 1000
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 3000,
        tokensPerMinute: 1000000
      }
    });

    this.registerModel({
      id: 'text-embedding-3-small',
      provider: 'openai',
      name: 'text-embedding-3-small',
      displayName: 'Text Embedding 3 Small',
      description: 'Efficient embedding model for most use cases',
      contextWindow: 8191,
      maxOutputTokens: 0,
      capabilities: ['embedding'],
      pricing: {
        inputTokens: 0.02,
        outputTokens: 0
      },
      performance: {
        averageLatency: 150,
        tokensPerSecond: 1500
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 3000,
        tokensPerMinute: 1000000
      }
    });

    this.logger.log('Default OpenAI models registered');

    // Add Anthropic Claude models
    this.registerAnthropicModels();
  }

  /**
   * Register Anthropic Claude models
   */
  private registerAnthropicModels(): void {
    // Claude 3.5 Sonnet
    this.registerModel({
      id: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet',
      description: 'Most capable Claude model with enhanced reasoning and coding',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming', 'advanced_reasoning', 'code_generation'],
      pricing: {
        inputTokens: 3.00, // per 1M tokens
        outputTokens: 15.00
      },
      performance: {
        averageLatency: 3000,
        tokensPerSecond: 40
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000
      }
    });

    // Claude 3.5 Haiku
    this.registerModel({
      id: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      name: 'claude-3-5-haiku-20241022',
      displayName: 'Claude 3.5 Haiku',
      description: 'Fastest Claude model, great for simple tasks and conversations',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming'],
      pricing: {
        inputTokens: 1.00,
        outputTokens: 5.00
      },
      performance: {
        averageLatency: 1000,
        tokensPerSecond: 100
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 2000,
        tokensPerMinute: 100000
      }
    });

    // Claude 3 Opus
    this.registerModel({
      id: 'claude-3-opus-20240229',
      provider: 'anthropic',
      name: 'claude-3-opus-20240229',
      displayName: 'Claude 3 Opus',
      description: 'Most intelligent Claude model for complex reasoning and creative tasks',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming', 'advanced_reasoning', 'complex_reasoning', 'creative_writing'],
      pricing: {
        inputTokens: 15.00,
        outputTokens: 75.00
      },
      performance: {
        averageLatency: 5000,
        tokensPerSecond: 25
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 200,
        tokensPerMinute: 20000
      }
    });

    // Claude 3 Sonnet
    this.registerModel({
      id: 'claude-3-sonnet-20240229',
      provider: 'anthropic',
      name: 'claude-3-sonnet-20240229',
      displayName: 'Claude 3 Sonnet',
      description: 'Balanced Claude model for most general-purpose tasks',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming', 'advanced_reasoning'],
      pricing: {
        inputTokens: 3.00,
        outputTokens: 15.00
      },
      performance: {
        averageLatency: 2500,
        tokensPerSecond: 50
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000
      }
    });

    // Claude 3 Haiku
    this.registerModel({
      id: 'claude-3-haiku-20240307',
      provider: 'anthropic',
      name: 'claude-3-haiku-20240307',
      displayName: 'Claude 3 Haiku',
      description: 'Fast and cost-effective Claude model for simple tasks',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: ['chat', 'vision', 'tool_calling', 'streaming'],
      pricing: {
        inputTokens: 0.25,
        outputTokens: 1.25
      },
      performance: {
        averageLatency: 800,
        tokensPerSecond: 120
      },
      availability: {
        regions: ['us', 'eu'],
        status: 'available'
      },
      limits: {
        requestsPerMinute: 2000,
        tokensPerMinute: 100000
      }
    });

    this.logger.log('Default Anthropic models registered');
  }
} 