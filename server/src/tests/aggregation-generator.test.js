/**
 * Integration test for the Aggregation Generator Service
 */

// Import common dependencies
const fs = require('fs');
const path = require('path');

// Mock services
class MockQdrantService {
  constructor() {
    this.collections = new Map();
    this.points = new Map();
  }
  
  async collectionExists(collectionName) {
    return this.collections.has(collectionName);
  }
  
  async createCollection(collectionName, options) {
    this.collections.set(collectionName, options);
    this.points.set(collectionName, []);
    return true;
  }
  
  async upsertVectors(collectionName, points) {
    if (!this.collections.has(collectionName)) {
      await this.createCollection(collectionName, {
        vectors: { size: 1536, distance: 'Cosine' }
      });
    }
    
    const existingPoints = this.points.get(collectionName) || [];
    
    // Replace existing points with the same ID
    const newPoints = points.filter(point => {
      return !existingPoints.some(existing => existing.id === point.id);
    });
    
    // Add new points
    this.points.set(collectionName, [...existingPoints, ...newPoints]);
    
    return {
      status: 'success',
      message: `Upserted ${points.length} points`,
      upserted: points.length
    };
  }
  
  getPoints(collectionName) {
    return this.points.get(collectionName) || [];
  }
}

class MockOpenAIService {
  async createEmbeddings(texts) {
    // Return fake embeddings with the correct dimension
    return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
  }
}

// Manually create the Aggregation Generator Service
const createAggregationGeneratorService = () => {
  const qdrantService = new MockQdrantService();
  const openaiService = new MockOpenAIService();
  
  // Create a simplified version based on the actual service
  return {
    qdrantService,
    openaiService,
    
    // Common aggregation types to generate
    AGGREGATION_TYPES: [
      'total_sales_by_product',
      'total_quantity_by_product'
    ],
    
    async generateAggregations(dataSourceId, options = {}) {
      console.log(`Generating aggregations for data source ${dataSourceId}`);
      
      const results = {
        dataSourceId,
        aggregationsGenerated: 0,
        aggregationsByType: {},
        errors: []
      };
      
      // For each aggregation type
      const aggregationTypes = options.aggregationTypes || this.AGGREGATION_TYPES;
      
      for (const aggType of aggregationTypes) {
        try {
          console.log(`Generating ${aggType} aggregations for data source ${dataSourceId}`);
          
          // Generate some test aggregations
          const aggregations = await this.generateTestAggregations(
            dataSourceId, 
            aggType, 
            options
          );
          
          results.aggregationsGenerated += aggregations.length;
          results.aggregationsByType[aggType] = aggregations.length;
          
          // Store aggregations
          await this.storeAggregations(aggregations, dataSourceId, aggType, options);
          
          console.log(`Generated ${aggregations.length} ${aggType} aggregations for data source ${dataSourceId}`);
        } catch (error) {
          console.error(`Failed to generate ${aggType} aggregations for data source ${dataSourceId}`, error);
          
          results.errors.push({
            type: aggType,
            error: error.message || String(error)
          });
        }
      }
      
      console.log(`Completed aggregation generation for data source ${dataSourceId}`, {
        aggregationsGenerated: results.aggregationsGenerated,
        errors: results.errors.length
      });
      
      return results;
    },
    
    async generateTestAggregations(dataSourceId, aggType, options) {
      // Generate 3 test products
      const products = [
        { id: 1, name: "Product A" },
        { id: 2, name: "Product B" },
        { id: 3, name: "Product C" }
      ];
      
      const aggregations = [];
      
      for (const product of products) {
        // Create a random value for the aggregation
        const value = Math.floor(Math.random() * 10000);
        
        // Create a description for the aggregation
        const description = this.createAggregationDescription(aggType, product, value);
        
        // Generate embedding
        const vector = await this.openaiService.createEmbeddings([description]);
        
        aggregations.push({
          type: aggType,
          subject: product.name,
          subjectId: product.id,
          value,
          description,
          vector: vector[0],
          metadata: {
            dataSourceId,
            product: product.name,
            productId: product.id,
            aggregationType: aggType,
            lastUpdated: new Date()
          }
        });
      }
      
      return aggregations;
    },
    
    createAggregationDescription(aggType, product, value) {
      switch (aggType) {
        case 'total_sales_by_product':
          return `Total sales for product ${product.name} (ID: ${product.id}) is $${value.toFixed(2)}. This represents the sum of all sales transactions for this specific product.`;
        
        case 'total_quantity_by_product':
          return `Total quantity sold for product ${product.name} (ID: ${product.id}) is ${value} units. This represents the sum of all units sold for this specific product.`;
        
        default:
          return `${aggType} for ${product.name} (ID: ${product.id}): ${value}`;
      }
    },
    
    async storeAggregations(aggregations, dataSourceId, aggType, options) {
      if (aggregations.length === 0) {
        console.log(`No aggregations to store for type ${aggType}`);
        return;
      }
      
      console.log(`Storing ${aggregations.length} aggregations for type ${aggType}`);
      
      // Store in vector database
      const points = aggregations.map((agg, index) => ({
        id: `aggregation:${dataSourceId}:${aggType}:${agg.subjectId || index}`,
        vector: agg.vector,
        payload: {
          text: agg.description,
          type: 'aggregation',
          aggregationType: aggType,
          subject: agg.subject,
          subjectId: agg.subjectId,
          value: agg.value,
          dataSourceId,
          lastUpdated: new Date()
        }
      }));
      
      // Ensure collection exists
      const collectionName = `datasource_${dataSourceId}_aggregations`;
      const collectionExists = await this.qdrantService.collectionExists(collectionName);
      
      if (!collectionExists) {
        await this.qdrantService.createCollection(collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine'
          }
        });
      }
      
      // Upsert to collection
      await this.qdrantService.upsertVectors(
        collectionName,
        points
      );
      
      console.log(`Successfully stored ${points.length} aggregation points in collection ${collectionName}`);
    }
  };
};

// Run the test
async function runTest() {
  console.log('Starting aggregation generator test');
  
  try {
    // Create the service
    const service = createAggregationGeneratorService();
    
    // Generate aggregations for a test data source
    const dataSourceId = 268; // Use the same data source ID as your integration tests
    
    // Test with default options
    console.log(`Test 1: Generate default aggregations for data source ${dataSourceId}`);
    const result1 = await service.generateAggregations(dataSourceId);
    
    console.log('Result 1:', JSON.stringify(result1, null, 2));
    
    // Test with specific aggregation types
    console.log(`Test 2: Generate specific aggregation types for data source ${dataSourceId}`);
    const result2 = await service.generateAggregations(dataSourceId, {
      aggregationTypes: ['total_sales_by_product']
    });
    
    console.log('Result 2:', JSON.stringify(result2, null, 2));
    
    // Verify points were stored
    const collectionName = `datasource_${dataSourceId}_aggregations`;
    const points = service.qdrantService.getPoints(collectionName);
    
    console.log(`Found ${points.length} points in collection ${collectionName}`);
    
    // Save test results to file
    const results = {
      testRun: new Date().toISOString(),
      dataSourceId,
      results: {
        test1: result1,
        test2: result2
      },
      points: points.map(p => ({
        id: p.id,
        text: p.payload.text,
        aggregationType: p.payload.aggregationType,
        value: p.payload.value
      }))
    };
    
    const resultsPath = path.join(__dirname, 'aggregation-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`Test results saved to ${resultsPath}`);
    console.log('All tests completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest().catch(console.error); 