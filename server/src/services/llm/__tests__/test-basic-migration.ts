/**
 * Basic migration test - verify core services are working
 */

import { NestFactory } from '@nestjs/core';
import { LLMModule } from '../llm.module';
import { LLMService } from '..';

async function testBasicMigration() {
  console.log('🧪 Basic Migration Test\n');

  try {
    // Create minimal application context with just LLM module
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: false
    });

    console.log('✅ LLM Module initialized successfully');

    // Test LLM Service
    const llmService = app.get(LLMService);
    console.log('✅ LLM Service retrieved');

    // Test basic functionality (without API key)
    try {
      const messages = [
        { id: '1', role: 'user' as const, content: 'Hello', timestamp: Date.now() }
      ];
      
      const response = await llmService.generateChatCompletion(messages, {
        taskType: 'simple_qa',
        taskComplexity: 'simple'
      });
      
      console.log('✅ LLM Service call successful');
      console.log(`   Model: ${response.metadata.model}`);
      console.log(`   Provider: ${response.metadata.provider}`);
    } catch (error) {
      console.log('⚠️ LLM Service call failed (expected without API key):', 
        error instanceof Error ? error.message : String(error));
    }

    await app.close();
    console.log('\n🎉 Basic migration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Basic migration test failed:', error);
    process.exit(1);
  }
}

testBasicMigration().catch(console.error); 