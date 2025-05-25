#!/usr/bin/env node

const http = require('http');

// Simple test for analytical RAG integration
async function testIntegration() {
  console.log('🔄 Testing Analytical RAG Integration...\n');
  
  const testQuery = {
    query: "Generate sample data and create a bar chart",
    sessionId: `integration-test-${Date.now()}`
  };
  
  const postData = JSON.stringify(testQuery);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/test-analytical',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Test Result:');
          console.log(`📍 Success: ${result.success}`);
          
          if (result.success && result.routingDecision) {
            console.log(`🎯 Routed to: ${result.routingDecision.chosenPath}`);
            console.log(`💭 Reasoning: ${result.routingDecision.reasoning?.substring(0, 100)}...`);
            
            if (result.analyticalResult) {
              console.log(`⚡ Execution time: ${result.analyticalResult.executionTime}ms`);
              console.log(`📊 Artifacts: ${result.analyticalResult.artifacts?.length || 0}`);
              console.log(`💡 Final answer preview: ${result.analyticalResult.finalAnswer?.substring(0, 100)}...`);
            }
          } else if (!result.success) {
            console.log(`❌ Error: ${result.error}`);
          }
          
          resolve(result);
        } catch (e) {
          console.log('❌ Failed to parse response:', e.message);
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`❌ Request error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Check if server is running
function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server not running on localhost:3000');
    console.log('Please start the server first');
    return;
  }
  
  try {
    await testIntegration();
    console.log('\n🎉 Integration test completed!');
  } catch (error) {
    console.log('\n💥 Integration test failed:', error.message);
  }
}

if (require.main === module) {
  main();
} 