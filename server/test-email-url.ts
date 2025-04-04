// Test script to verify SendGrid email URL generation 
import { SendGridService } from './src/infrastructure/email/sendgrid';

// Simulate a verification token
const testToken = 'test-verification-token-12345';

// Create the SendGrid service instance
const emailService = new SendGridService();

// Mock process.env.FRONTEND_URL with the problematic value
process.env.FRONTEND_URL = 'https://d29r17dfwnrk41.cloudfront.net,https://app.ciroai.us';
process.env.NODE_ENV = 'production';

// Define a test function to check verification URL
async function testVerificationUrl() {
  console.log('Testing email URL generation with problematic FRONTEND_URL value:');
  console.log(`FRONTEND_URL = ${process.env.FRONTEND_URL}`);
  console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
  console.log('--------------------------------------------------');
  
  try {
    // We won't actually send the email, we'll just log the URL that would be generated
    // @ts-ignore - accessing private method for testing
    const frontendUrl = emailService.getSanitizedFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${testToken}`;
    
    console.log('Generated Frontend URL:', frontendUrl);
    console.log('Full Verification URL:', verificationUrl);
    console.log('--------------------------------------------------');
    
    if (verificationUrl.includes(',')) {
      console.log('❌ TEST FAILED: URL contains comma, which would cause issues');
    } else {
      console.log('✅ TEST PASSED: URL is properly formatted without commas');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testVerificationUrl(); 