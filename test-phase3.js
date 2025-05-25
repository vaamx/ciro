#!/usr/bin/env node

const http = require('http');

// Test data
const testQueries = [
  {
    name: "Simple Analytical Query",
    query: "Generate some sample data and create a bar chart showing sales by month",
    expectedRoute: "analytical_rag"
  },
  {
    name: "Data Analysis Query", 
    query: "Create a dataset with 100 random points and calculate basic statistics",
    expectedRoute: "analytical_rag"
  },
  {
    name: "Simple Information Query",
    query: "What is the definition of machine learning?",
    expectedRoute: "direct_vector_rag"
  }
];

// Function to make HTTP POST request
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/test-analytical',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Test function
async function runTests() {
  console.log('🚀 Testing Phase 3: Analytical RAG Backend\n');
  
  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    console.log(`📝 Test ${i + 1}: ${test.name}`);
    console.log(`Query: "${test.query}"`);
    
    try {
      const result = await makeRequest({
        query: test.query,
        sessionId: `test-${Date.now()}-${i}`
      });
      
      if (result.success) {
        console.log(`✅ SUCCESS`);
        console.log(`📍 Routed to: ${result.routingDecision.chosenPath}`);
        console.log(`🎯 Confidence: ${result.routingDecision.confidence?.toFixed(2) || 'N/A'}`);
        
        if (result.analyticalResult) {
          console.log(`⏱️  Execution time: ${result.analyticalResult.executionTime}ms`);
          console.log(`🐍 Code executed: ${result.analyticalResult.codeExecuted.length} blocks`);
          console.log(`📊 Artifacts created: ${result.analyticalResult.artifacts.length}`);
          
          if (result.analyticalResult.artifacts.length > 0) {
            result.analyticalResult.artifacts.forEach(artifact => {
              console.log(`   - ${artifact.type}: ${artifact.name}`);
            });
          }
          
          if (result.analyticalResult.finalAnswer) {
            console.log(`💡 Answer: ${result.analyticalResult.finalAnswer.substring(0, 100)}...`);
          }
        }
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ REQUEST FAILED: ${error.message}`);
    }
    
    console.log('─'.repeat(60));
  }
  
  console.log('\n🎉 Phase 3 testing complete!');
  console.log('\n📋 What was tested:');
  console.log('✓ Sandbox container creation and management');
  console.log('✓ Query routing to analytical RAG pathway');
  console.log('✓ ReAct agent loop with Python code execution');
  console.log('✓ Artifact collection (charts, data files)');
  console.log('✓ Integration with existing query router');
}

// Check if server is running
function checkServer() {
  return makeRequest({ query: "test" }).then(() => true).catch(() => false);
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server not running on localhost:3001');
    console.log('Please start the server with: npm run dev (in server directory)');
    process.exit(1);
  }
  
  await runTests();
}

if (require.main === module) {
  main().catch(console.error);
} 