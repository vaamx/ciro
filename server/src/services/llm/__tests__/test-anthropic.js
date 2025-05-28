/**
 * Test script for Anthropic provider integration
 * Run with: node test-anthropic.js
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testAnthropicProvider() {
  console.log('🧪 Testing Anthropic Provider Integration...\n');

  try {
    // Bootstrap the NestJS application
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log']
    });

    // Get the LLM service
    const llmService = app.get('LLMService');
    
    console.log('✅ Application context created successfully\n');

    // Test 1: Simple chat completion
    console.log('🔬 Test 1: Simple chat completion with Claude');
    const simpleResponse = await llmService.generateChatCompletion([
      {
        role: 'user',
        content: 'Hello! Can you tell me what makes Claude unique as an AI assistant?'
      }
    ], {
      model: 'claude-3-5-haiku-20241022', // Use fast model for test
      temperature: 0.7,
      maxTokens: 150
    });

    console.log('📝 Response:', simpleResponse.content.substring(0, 200) + '...');
    console.log('📊 Usage:', simpleResponse.usage);
    console.log('⚙️  Model used:', simpleResponse.metadata.model);
    console.log('🏢 Provider:', simpleResponse.metadata.provider);
    console.log('⏱️  Processing time:', simpleResponse.metadata.processingTime + 'ms\n');

    // Test 2: Intelligent model selection for complex reasoning
    console.log('🔬 Test 2: Intelligent model selection for complex reasoning');
    const complexResponse = await llmService.generateChatCompletion([
      {
        role: 'user',
        content: 'Analyze the philosophical implications of consciousness in artificial intelligence. Provide a structured argument with multiple perspectives.'
      }
    ], {
      taskType: 'complex_reasoning',
      taskComplexity: 'complex',
      temperature: 0.8,
      maxTokens: 200
    });

    console.log('📝 Response:', complexResponse.content.substring(0, 200) + '...');
    console.log('⚙️  Auto-selected model:', complexResponse.metadata.model);
    console.log('🏢 Provider:', complexResponse.metadata.provider);
    console.log('⏱️  Processing time:', complexResponse.metadata.processingTime + 'ms\n');

    // Test 3: Code generation preference
    console.log('🔬 Test 3: Code generation task routing');
    const codeResponse = await llmService.generateChatCompletion([
      {
        role: 'user',
        content: 'Write a Python function to calculate the Fibonacci sequence using memoization. Include docstring and type hints.'
      }
    ], {
      taskType: 'code_generation',
      temperature: 0.2,
      maxTokens: 300
    });

    console.log('📝 Response:', codeResponse.content.substring(0, 200) + '...');
    console.log('⚙️  Auto-selected model:', codeResponse.metadata.model);
    console.log('🏢 Provider:', codeResponse.metadata.provider);
    console.log('⏱️  Processing time:', codeResponse.metadata.processingTime + 'ms\n');

    // Test 4: Model registry information
    console.log('🔬 Test 4: Available models from registry');
    const modelRegistry = app.get('ModelRegistry');
    const anthropicModels = modelRegistry.getModelsByProvider('anthropic');
    
    console.log('🤖 Available Anthropic models:');
    anthropicModels.forEach(model => {
      console.log(`  - ${model.displayName} (${model.id})`);
      console.log(`    💰 Cost: $${model.pricing.inputTokens}/1M input, $${model.pricing.outputTokens}/1M output`);
      console.log(`    🧠 Capabilities: ${model.capabilities.join(', ')}`);
      console.log(`    📏 Context: ${model.contextWindow.toLocaleString()} tokens\n`);
    });

    // Test 5: Provider availability check
    console.log('🔬 Test 5: Provider availability check');
    const anthropicProvider = app.get('AnthropicProvider');
    const isAvailable = await anthropicProvider.isAvailable();
    console.log('🔌 Anthropic provider available:', isAvailable ? '✅ Yes' : '❌ No');
    
    if (!isAvailable) {
      console.log('💡 Note: Set ANTHROPIC_API_KEY environment variable to enable Anthropic provider');
    }

    await app.close();
    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAnthropicProvider().catch(console.error); 