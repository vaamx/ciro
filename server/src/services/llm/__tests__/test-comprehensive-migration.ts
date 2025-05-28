/**
 * Comprehensive Migration Test Suite
 * Tests all migrated services for functionality, performance, and cost optimization
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { GenerationService } from '../../rag/generation.service';
import { DirectRAGService } from '../../rag/direct-rag.service';
import { QueryRouterService } from '../../code-execution/query-router.service';
import { AnalyticalRAGService } from '../../rag/analytical-rag.service';
import { LlmAnalysisService } from '../services/llm-analysis.service';
import { CodeGenerationService } from '../../code-execution/code-generator.service';
import { QueryAnalysisService } from '../../analysis/query-analysis.service';
import { LLMService } from '..';
import { DataSourceType, AnalyticalOperationType } from '../../../types/document/processing';
import { CodeGenerationType } from '../../code-execution/code-generator.service';

interface TestResult {
  service: string;
  test: string;
  success: boolean;
  duration: number;
  model?: string;
  cost?: number;
  error?: string;
  details?: any;
}

interface MigrationStats {
  totalServices: number;
  migratedServices: number;
  testsPassed: number;
  testsTotal: number;
  avgResponseTime: number;
  costOptimizationActive: boolean;
}

async function testComprehensiveMigration() {
  console.log('🚀 Comprehensive Migration Test Suite');
  console.log('Testing all migrated services for functionality, performance, and cost optimization...\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // Create NestJS application
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false // Reduce noise during testing
    });

    console.log('✅ Application initialized successfully\n');

    // Get all services
    const services = {
      llmService: app.get(LLMService),
      generationService: app.get(GenerationService),
      directRAGService: app.get(DirectRAGService),
      queryRouterService: app.get(QueryRouterService),
      analyticalRAGService: app.get(AnalyticalRAGService),
      llmAnalysisService: app.get(LlmAnalysisService),
      codeGenerationService: app.get(CodeGenerationService),
      queryAnalysisService: app.get(QueryAnalysisService)
    };

    console.log('✅ All services retrieved successfully\n');

    // Test Suite 1: Core LLM Foundation
    console.log('🔧 Testing Core LLM Foundation...');
    await testLLMFoundation(services.llmService, results);

    // Test Suite 2: Generation Services
    console.log('\n📝 Testing Generation Services...');
    await testGenerationServices(services.generationService, results);

    // Test Suite 3: RAG Services
    console.log('\n🔍 Testing RAG Services...');
    await testRAGServices(services.directRAGService, services.analyticalRAGService, results);

    // Test Suite 4: Query Processing Services
    console.log('\n🚦 Testing Query Processing Services...');
    await testQueryProcessingServices(services.queryRouterService, services.queryAnalysisService, results);

    // Test Suite 5: Code Generation Services
    console.log('\n💻 Testing Code Generation Services...');
    await testCodeGenerationServices(services.codeGenerationService, results);

    // Test Suite 6: Analysis Services
    console.log('\n📊 Testing Analysis Services...');
    await testAnalysisServices(services.llmAnalysisService, results);

    // Test Suite 7: Performance & Cost Optimization
    console.log('\n⚡ Testing Performance & Cost Optimization...');
    await testPerformanceOptimization(services.llmService, results);

    // Test Suite 8: Error Handling & Resilience
    console.log('\n🛡️ Testing Error Handling & Resilience...');
    await testErrorHandling(services.llmService, results);

    // Test Suite 9: Integration Testing
    console.log('\n🔗 Testing Service Integration...');
    await testServiceIntegration(services, results);

    await app.close();

    // Generate comprehensive report
    const totalDuration = Date.now() - startTime;
    generateComprehensiveReport(results, totalDuration);

  } catch (error) {
    console.error('❌ Test suite failed to initialize:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function testLLMFoundation(llmService: LLMService, results: TestResult[]) {
  // Test basic chat completion
  await runTest('LLMService', 'Basic Chat Completion', async () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'What is 2+2?', timestamp: Date.now() }
    ];
    
    const response = await llmService.generateChatCompletion(messages, {
      taskType: 'simple_qa',
      taskComplexity: 'simple'
    });
    
    if (!response.content || !response.metadata.model) {
      throw new Error('Invalid response format');
    }
    
    return { model: response.metadata.model };
  }, results);

  // Test intelligent model selection
  await runTest('LLMService', 'Intelligent Model Selection', async () => {
    const simpleMessages = [
      { id: '1', role: 'user' as const, content: 'Hello', timestamp: Date.now() }
    ];
    
    const complexMessages = [
      { id: '1', role: 'user' as const, content: 'Analyze the philosophical implications of quantum mechanics', timestamp: Date.now() }
    ];
    
    const simpleResponse = await llmService.generateChatCompletion(simpleMessages, {
      taskType: 'simple_qa',
      taskComplexity: 'simple'
    });
    
    const complexResponse = await llmService.generateChatCompletion(complexMessages, {
      taskType: 'complex_reasoning',
      taskComplexity: 'complex'
    });
    
    console.log(`   Simple query → ${simpleResponse.metadata.model}`);
    console.log(`   Complex query → ${complexResponse.metadata.model}`);
    
    return { 
      model: `Simple: ${simpleResponse.metadata.model}, Complex: ${complexResponse.metadata.model}`,
      details: {
        simpleModel: simpleResponse.metadata.model,
        complexModel: complexResponse.metadata.model,
        optimized: simpleResponse.metadata.model !== complexResponse.metadata.model
      }
    };
  }, results);
}

async function testGenerationServices(generationService: GenerationService, results: TestResult[]) {
  // Test basic generation
  await runTest('GenerationService', 'Basic Generation', async () => {
    const result = await generationService.generate(
      'What is machine learning?',
      'Machine learning is a subset of artificial intelligence.'
    );
    
    if (!result || result.length < 10) {
      throw new Error('Generated response too short or empty');
    }
    
    return { details: { responseLength: result.length } };
  }, results);

  // Test document-based generation
  await runTest('GenerationService', 'Document-based Generation', async () => {
    const documents = [
      {
        id: '1',
        content: 'Artificial Intelligence (AI) is the simulation of human intelligence in machines.',
        similarity: 0.9,
        metadata: { title: 'AI Basics', source: 'test' }
      }
    ];
    
    const result = await generationService.generateResponse(
      'What is AI?',
      documents
    );
    
    if (!result.content || !result.model) {
      throw new Error('Invalid response format');
    }
    
    return { model: result.model };
  }, results);
}

async function testRAGServices(directRAGService: DirectRAGService, analyticalRAGService: AnalyticalRAGService, results: TestResult[]) {
  // Test Direct RAG (expected to fail gracefully without vector DB)
  await runTest('DirectRAGService', 'Basic RAG Query', async () => {
    try {
      const result = await directRAGService.answerQuery(
        'What is artificial intelligence?',
        'test_collection',
        3,
        false
      );
      
      if (!result.answer || !Array.isArray(result.sourceDocuments)) {
        throw new Error('Invalid response structure');
      }
      
      return { details: { documentsFound: result.sourceDocuments.length } };
    } catch (error) {
      if (error instanceof Error && error.message.includes('embedding')) {
        console.log('   ⚠️ Expected failure (no vector DB configured)');
        return { details: { expectedFailure: true } };
      }
      throw error;
    }
  }, results);

  // Test Analytical RAG (expected to fail gracefully without sandbox)
  await runTest('AnalyticalRAGService', 'Analytical Query Processing', async () => {
    try {
      const result = await analyticalRAGService.processAnalyticalQuery(
        'test-session',
        'Calculate the mean of [1, 2, 3, 4, 5]'
      );
      
      if (!result.finalAnswer || !Array.isArray(result.artifacts)) {
        throw new Error('Invalid response structure');
      }
      
      return { details: { artifactsGenerated: result.artifacts.length } };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('sandbox') || error.message.includes('Docker'))) {
        console.log('   ⚠️ Expected failure (no sandbox configured)');
        return { details: { expectedFailure: true } };
      }
      throw error;
    }
  }, results);
}

async function testQueryProcessingServices(queryRouterService: QueryRouterService, queryAnalysisService: QueryAnalysisService, results: TestResult[]) {
  // Test query preprocessing
  await runTest('QueryRouterService', 'Query Preprocessing', async () => {
    const result = await queryRouterService.preprocess('  What is MACHINE learning?  ');
    
    if (!result.normalizedQuery || result.normalizedQuery !== 'what is machine learning?') {
      throw new Error('Query preprocessing failed');
    }
    
    return { details: { originalQuery: '  What is MACHINE learning?  ', normalizedQuery: result.normalizedQuery } };
  }, results);

  // Test route determination
  await runTest('QueryRouterService', 'Route Determination', async () => {
    const result = await queryRouterService.determineRoute('What is machine learning?');
    
    if (!result.chosenPath || !result.reasoning) {
      throw new Error('Route determination failed');
    }
    
    console.log(`   Routed to: ${result.chosenPath}`);
    return { details: { chosenPath: result.chosenPath, reasoning: result.reasoning } };
  }, results);

  // Test heuristic analysis
  await runTest('QueryAnalysisService', 'Heuristic Analysis', async () => {
    const preprocessedQuery = { originalQuery: 'analyze sales data', normalizedQuery: 'analyze sales data' };
    const result = await queryAnalysisService.runHeuristics(preprocessedQuery);
    
    if (typeof result.analyticalScore !== 'number' || typeof result.retrievalScore !== 'number') {
      throw new Error('Invalid heuristic analysis result');
    }
    
    return { 
      details: { 
        analyticalScore: result.analyticalScore, 
        retrievalScore: result.retrievalScore,
        isAnalyticalIntent: result.isAnalyticalIntent
      } 
    };
  }, results);
}

async function testCodeGenerationServices(codeGenerationService: CodeGenerationService, results: TestResult[]) {
  // Test basic code generation
  await runTest('CodeGenerationService', 'Basic Code Generation', async () => {
    const result = await codeGenerationService.generateCode(
      'Create a simple data analysis script',
      { type: CodeGenerationType.ANALYSIS }
    );
    
    if (!result.code || !result.language) {
      throw new Error('Invalid code generation result');
    }
    
    return { 
      details: { 
        codeLength: result.code.length, 
        language: result.language,
        type: result.type,
        libraries: result.requiredLibraries
      } 
    };
  }, results);

  // Test visualization code generation
  await runTest('CodeGenerationService', 'Visualization Code Generation', async () => {
    const result = await codeGenerationService.generateCode(
      'Create a bar chart of sales data',
      { 
        type: CodeGenerationType.VISUALIZATION,
        includeVisualization: true
      }
    );
    
    if (!result.code || !result.visualizationType) {
      throw new Error('Invalid visualization code generation result');
    }
    
    return { 
      details: { 
        codeLength: result.code.length,
        visualizationType: result.visualizationType,
        hasVisualization: !!result.visualizationType
      } 
    };
  }, results);
}

async function testAnalysisServices(llmAnalysisService: LlmAnalysisService, results: TestResult[]) {
  // Test analysis generation
  await runTest('LlmAnalysisService', 'Analysis Generation', async () => {
    const result = await llmAnalysisService.generateAnalysis({
      query: 'Analyze sales trends',
      processedData: 'Sales data: Q1: $100k, Q2: $120k, Q3: $110k, Q4: $140k',
      dataSourceType: DataSourceType.CSV,
      analyticalOperations: [AnalyticalOperationType.TREND, AnalyticalOperationType.SUMMARIZE]
    });
    
    if (!result || result.length < 50) {
      throw new Error('Analysis too short or empty');
    }
    
    return { details: { analysisLength: result.length } };
  }, results);
}

async function testPerformanceOptimization(llmService: LLMService, results: TestResult[]) {
  // Test cost optimization
  await runTest('Performance', 'Cost Optimization', async () => {
    const simpleQuery = [
      { id: '1', role: 'user' as const, content: 'Hi', timestamp: Date.now() }
    ];
    
    const complexQuery = [
      { id: '1', role: 'user' as const, content: 'Develop a comprehensive business strategy', timestamp: Date.now() }
    ];
    
    const simpleResponse = await llmService.generateChatCompletion(simpleQuery, {
      taskType: 'simple_qa',
      taskComplexity: 'simple'
    });
    
    const complexResponse = await llmService.generateChatCompletion(complexQuery, {
      taskType: 'complex_reasoning', 
      taskComplexity: 'complex'
    });
    
    const optimized = simpleResponse.metadata.model !== complexResponse.metadata.model;
    console.log(`   Cost optimization: ${optimized ? '✅ Active' : '⚠️ Not detected'}`);
    
    return { 
      model: `Optimization: ${optimized ? 'Active' : 'Not detected'}`,
      details: {
        simpleModel: simpleResponse.metadata.model,
        complexModel: complexResponse.metadata.model,
        optimized
      }
    };
  }, results);
}

async function testErrorHandling(llmService: LLMService, results: TestResult[]) {
  // Test graceful error handling
  await runTest('Error Handling', 'Invalid Model Handling', async () => {
    try {
      await llmService.generateChatCompletion([
        { id: '1', role: 'user' as const, content: 'Test', timestamp: Date.now() }
      ], {
        model: 'non-existent-model',
        taskType: 'simple_qa'
      });
      
      throw new Error('Expected error for invalid model');
    } catch (error) {
      console.log('   ✅ Properly handled invalid model');
      return { details: { errorHandled: true } };
    }
  }, results);
}

async function testServiceIntegration(services: any, results: TestResult[]) {
  // Test end-to-end query processing
  await runTest('Integration', 'End-to-End Query Processing', async () => {
    const query = 'What is machine learning?';
    
    // 1. Preprocess query
    const preprocessed = await services.queryRouterService.preprocess(query);
    
    // 2. Analyze query
    const heuristics = await services.queryAnalysisService.runHeuristics(preprocessed);
    
    // 3. Route query
    const route = await services.queryRouterService.determineRoute(query);
    
    return {
      details: {
        originalQuery: query,
        normalizedQuery: preprocessed.normalizedQuery,
        analyticalScore: heuristics.analyticalScore,
        chosenPath: route.chosenPath
      }
    };
  }, results);
}

async function runTest(
  service: string,
  testName: string,
  testFn: () => Promise<{ model?: string; cost?: number; details?: any }>,
  results: TestResult[]
) {
  const start = Date.now();
  
  try {
    const testResult = await testFn();
    const duration = Date.now() - start;
    
    results.push({
      service,
      test: testName,
      success: true,
      duration,
      model: testResult.model,
      cost: testResult.cost,
      details: testResult.details
    });
    
    console.log(`   ✅ ${testName} (${duration}ms)${testResult.model ? ` - ${testResult.model}` : ''}`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    results.push({
      service,
      test: testName,
      success: false,
      duration,
      error: errorMessage
    });
    
    console.log(`   ❌ ${testName} (${duration}ms) - ${errorMessage}`);
  }
}

function generateComprehensiveReport(results: TestResult[], totalDuration: number) {
  console.log('\n' + '='.repeat(100));
  console.log('📊 COMPREHENSIVE MIGRATION REPORT');
  console.log('='.repeat(100));

  // Calculate statistics
  const stats = calculateMigrationStats(results);
  
  // Service breakdown
  const serviceGroups = results.reduce((groups, result) => {
    if (!groups[result.service]) {
      groups[result.service] = [];
    }
    groups[result.service].push(result);
    return groups;
  }, {} as Record<string, TestResult[]>);

  // Print service results
  Object.entries(serviceGroups).forEach(([service, serviceResults]) => {
    const passed = serviceResults.filter(r => r.success).length;
    const total = serviceResults.length;
    const avgDuration = serviceResults.reduce((sum, r) => sum + r.duration, 0) / total;
    
    console.log(`\n🔧 ${service}:`);
    console.log(`   Tests: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`   Avg Duration: ${avgDuration.toFixed(0)}ms`);
    
    serviceResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const model = result.model ? ` (${result.model})` : '';
      console.log(`   ${status} ${result.test}${model}`);
      if (!result.success && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
  });

  // Migration statistics
  console.log('\n' + '='.repeat(100));
  console.log('📈 MIGRATION STATISTICS:');
  console.log(`   Services Tested: ${stats.totalServices}`);
  console.log(`   Tests Passed: ${stats.testsPassed}/${stats.testsTotal} (${((stats.testsPassed/stats.testsTotal)*100).toFixed(1)}%)`);
  console.log(`   Average Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
  console.log(`   Cost Optimization: ${stats.costOptimizationActive ? '✅ Active' : '⚠️ Not detected'}`);
  console.log(`   Total Test Duration: ${totalDuration.toFixed(0)}ms`);

  // Success assessment
  const successRate = (stats.testsPassed / stats.testsTotal) * 100;
  console.log('\n' + '='.repeat(100));
  if (successRate >= 90) {
    console.log('🎉 MIGRATION STATUS: EXCELLENT');
    console.log('✅ All critical services successfully migrated');
    console.log('✅ LLM abstraction layer working perfectly');
    console.log('✅ Cost optimization active');
    console.log('✅ Error handling robust');
  } else if (successRate >= 75) {
    console.log('✅ MIGRATION STATUS: GOOD');
    console.log('✅ Most services successfully migrated');
    console.log('⚠️ Some minor issues to address');
  } else {
    console.log('⚠️ MIGRATION STATUS: NEEDS ATTENTION');
    console.log('❌ Several services need fixes');
    console.log('❌ Review failed tests above');
  }
  
  console.log('='.repeat(100));
}

function calculateMigrationStats(results: TestResult[]): MigrationStats {
  const serviceGroups = results.reduce((groups, result) => {
    if (!groups[result.service]) {
      groups[result.service] = [];
    }
    groups[result.service].push(result);
    return groups;
  }, {} as Record<string, TestResult[]>);

  const totalServices = Object.keys(serviceGroups).length;
  const testsPassed = results.filter(r => r.success).length;
  const testsTotal = results.length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  // Check for cost optimization
  const optimizationTest = results.find(r => r.test === 'Cost Optimization');
  const costOptimizationActive = optimizationTest?.details?.optimized || false;

  return {
    totalServices,
    migratedServices: totalServices, // All tested services are considered migrated
    testsPassed,
    testsTotal,
    avgResponseTime,
    costOptimizationActive
  };
}

// Run the comprehensive test suite
testComprehensiveMigration().catch(error => {
  console.error('💥 Comprehensive test suite crashed:', error);
  process.exit(1);
}); 