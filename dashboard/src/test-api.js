// Simple test to verify our API service works correctly
import { apiService } from './services/api';

console.log('API Service:', apiService);
console.log('Methods available:');
for (const method in apiService) {
  if (typeof apiService[method] === 'function') {
    console.log(`- ${method}`);
  }
}

// Test creating a session
async function testApiService() {
  try {
    console.log('Testing createChatSession...');
    const session = await apiService.createChatSession('Test Session', { 
      organizationId: 1, 
      dashboardId: 'test-dashboard'
    });
    console.log('Session created:', session);
    
    // Now test sending a message
    console.log('Testing sendMessage...');
    const response = await apiService.sendMessage(
      session.id,
      'Hello, this is a test message',
      { organizationId: 1, dashboardId: 'test-dashboard' }
    );
    console.log('Message response:', response);
    
    console.log('Tests completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Uncomment to run the test
// testApiService(); 