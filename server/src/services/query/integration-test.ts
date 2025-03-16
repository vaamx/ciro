/**
 * Integration test for the query components
 * 
 * This file demonstrates how all the components work together:
 * - EnhancedMetadataService
 * - QueryClassifierService
 * - QueryStrategySelector
 * - HybridSearchEngine
 * - RAGIntegrationService
 * 
 * Run this file to test the integration and see how queries are processed
 */

import { EnhancedMetadataService } from '../metadata-extraction/enhanced-metadata-service';
import { QueryClassifierService } from './query-classifier.service';
import { QueryStrategySelector, StrategyType } from './query-strategy-selector.service';
import { HybridSearchEngine } from './hybrid-search-engine.service';
import { RAGIntegrationService } from './rag-integration.service';
import { createServiceLogger } from '../../utils/logger-factory';
import { QdrantService } from '../qdrant.service';

const logger = createServiceLogger('IntegrationTest');

/**
 * Test the integration of all query components
 */
async function testQueryIntegration() {
  try {
    logger.info('Starting integration test for query components');

    // 1. Initialize all services (they should use the singleton pattern)
    const metadataService = EnhancedMetadataService.getInstance();
    const queryClassifier = QueryClassifierService.getInstance();
    // Create QueryStrategySelector with its dependencies
    const qdrantService = new QdrantService();
    const strategySelector = new QueryStrategySelector(queryClassifier, qdrantService);
    const hybridSearchEngine = HybridSearchEngine.getInstance();
    const ragIntegration = RAGIntegrationService.getInstance();

    logger.info('All services initialized');

    // 2. Test individual components
    
    // 2.1 Test query classification
    const testQuery = 'What are the total sales of nachos?';
    logger.info(`Testing query classification for: "${testQuery}"`);
    
    const classification = await queryClassifier.classifyQuery(testQuery);
    logger.info(`Query classification result:`, {
      type: classification.type,
      entities: classification.entities,
      aggregationFunction: classification.aggregationFunction,
      confidence: classification.confidence,
      complexity: classification.complexity
    });

    // 2.2 Test strategy selection
    logger.info(`Testing strategy selection for: "${testQuery}"`);
    
    const strategy = await strategySelector.selectStrategy(testQuery);
    logger.info(`Strategy selection result:`, {
      strategyType: strategy.strategyType,
      executionPlan: strategy.executionPlan
    });
    
    // 2.3 Test direct strategy selection from RAG service
    logger.info(`Testing direct strategy selection from RAG service for: "${testQuery}"`);
    
    const directStrategy = await ragIntegration.selectQueryStrategy(testQuery);
    logger.info(`Direct strategy selection result:`, {
      strategyType: directStrategy.strategyType,
      executionPlan: directStrategy.executionPlan
    });

    // 3. Test the RAG integration with automatic strategy selection
    logger.info(`Testing RAG integration with automatic strategy selection for: "${testQuery}"`);
    
    const ragResult = await ragIntegration.executeRAGQuery(testQuery, {
      dataSourceId: 268, // Use our real data source ID with indexed data
      maxResults: 5
    });

    logger.info(`RAG integration result:`, {
      answer: ragResult.answer,
      executionDetails: ragResult.executionDetails,
      sourcesCount: ragResult.sources.length,
      selectedStrategy: ragResult.selectedStrategy?.strategyType
    });
    
    // 4. Test the RAG integration with forced strategy
    logger.info(`Testing RAG integration with forced strategy for: "${testQuery}"`);
    
    const forcedResult = await ragIntegration.executeRAGQuery(testQuery, {
      dataSourceId: 268, // Use our real data source ID with indexed data
      maxResults: 5,
      forceStrategy: strategySelector.STRATEGY_TYPE.FULL_SCAN_AGGREGATION // Use constant instead of type
    });

    logger.info(`RAG integration with forced strategy result:`, {
      answer: forcedResult.answer,
      executionDetails: forcedResult.executionDetails,
      sourcesCount: forcedResult.sources.length,
      selectedStrategy: forcedResult.selectedStrategy?.strategyType
    });

    logger.info('Integration test completed successfully');
  } catch (error) {
    logger.error(`Integration test failed:`, error);
  }
}

// Uncomment to run the test directly
testQueryIntegration().catch(console.error);

export { testQueryIntegration }; 