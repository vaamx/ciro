namespace PerformanceTest {
  const { PerformanceMonitoringService } = require('../server/src/utils/performance-monitoring');
  const path = require('path');
  const dotenv = require('dotenv');
  const fs = require('fs/promises');

  // Load environment variables
  dotenv.config({ path: path.join(process.cwd(), '.env') });

  // Sample test queries
  const TEST_QUERIES = [
    "What is the relationship between climate change and biodiversity?",
    "Explain the concepts of machine learning algorithms",
    "How do databases handle large amounts of data?",
    "What are the best practices for software development?",
    "Can you analyze the impact of social media on society?"
  ];

  // Test data source IDs (replace with actual IDs from your system)
  const TEST_DATA_SOURCE_IDS = ['source1', 'source2'];

  // Mock retrieval function for testing
  async function mockRetrievalFunction(query: string, dataSourceIds: string[]) {
    // Simulate different response times based on query complexity
    const complexity = 0.5 + Math.random() * 1.5;
    const responseTime = 500 + Math.floor(Math.random() * 2000 * complexity);
    
    // Simulate processing
    await new Promise<void>((resolve) => setTimeout(resolve, responseTime));
    
    // Generate mock documents
    const documentCount = Math.floor(5 + Math.random() * 20);
    const documents = Array.from({ length: documentCount }).map((_, i: number) => ({
      id: `doc-${i}`,
      text: `Document ${i} related to "${query.substring(0, 20)}..."`,
      similarity: 0.5 + Math.random() * 0.5,
      metadata: {
        source: dataSourceIds[i % dataSourceIds.length],
        timestamp: new Date().toISOString()
      }
    }));
    
    // Occasionally simulate errors
    if (Math.random() < 0.1) {
      throw new Error('Simulated retrieval error');
    }
    
    return {
      documents,
      totalFound: documentCount * 2, // Pretend we found more but only returned top N
      query,
      dataSourceIds
    };
  }

  export async function runPerformanceTests() {
    console.log('Starting RAG performance tests...');
    
    // Create performance monitoring service
    const perfService = new PerformanceMonitoringService(
      path.join(process.cwd(), 'analysis', 'rag-performance-tests.json')
    );
    
    // Run each test query
    for (const query of TEST_QUERIES) {
      console.log(`Testing query: "${query.substring(0, 40)}..."`);
      
      // Test with varying data source counts
      for (let sourceCount = 1; sourceCount <= TEST_DATA_SOURCE_IDS.length; sourceCount++) {
        const dataSourceIds = TEST_DATA_SOURCE_IDS.slice(0, sourceCount);
        console.log(`  With ${sourceCount} data source(s)`);
        
        // Run the test
        const metrics = await perfService.measureRagPerformance(
          query,
          dataSourceIds,
          () => mockRetrievalFunction(query, dataSourceIds)
        );
        
        console.log(`  Results: ${metrics.documentsRetrieved} docs in ${metrics.totalTime.toFixed(2)}ms (${metrics.success ? 'SUCCESS' : 'FAILED'})`);
      }
    }
    
    // Generate and display performance report
    const report = await perfService.generatePerformanceReport();
    console.log('\nPerformance Test Report:');
    console.log(report);
    
    // Save report to file
    await fs.writeFile(
      path.join(process.cwd(), 'analysis', 'performance-report.md'),
      report,
      'utf8'
    );
    
    console.log('Test complete. Results saved to analysis/rag-performance-tests.json');
    console.log('Report saved to analysis/performance-report.md');
  }
}

// Run the tests
PerformanceTest.runPerformanceTests().catch((error: any) => {
  console.error('Unhandled error during tests:', error);
  process.exit(1);
}); 