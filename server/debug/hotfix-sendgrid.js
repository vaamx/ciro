/**
 * This script creates a fixed version of the sendgrid.js file with proper URL generation
 * It can be used as a hotfix while we're fixing the deployment issues
 */

const fs = require('fs');
const path = require('path');

// Path to the original SendGrid file
const originalFilePath = path.join(__dirname, '../dist/src/infrastructure/email/sendgrid.js');

// Ensure the file exists
if (!fs.existsSync(originalFilePath)) {
  console.error(`Error: File not found at ${originalFilePath}`);
  process.exit(1);
}

// Read the file content
const originalContent = fs.readFileSync(originalFilePath, 'utf8');

// Define the fix - add a sanitizeUrl function and update URL generation
const fixedContent = originalContent.replace(
  /function createPasswordResetEmail\(email, token\) {/,
  `// Helper function to ensure URL has proper format
function sanitizeUrl(url) {
  // Remove trailing slashes
  let sanitized = url.trim().replace(/\\/+$/, '');
  
  // Ensure URL has http/https protocol
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    sanitized = 'https://' + sanitized;
  }
  
  return sanitized;
}

function createPasswordResetEmail(email, token) {
  // Sanitize frontend URL
  const baseUrl = sanitizeUrl(process.env.FRONTEND_URL || 'https://app.ciroai.us');`
).replace(
  /const resetUrl = `\$\{process.env.FRONTEND_URL\}\/reset-password\?token=\$\{token\}`/g,
  `const resetUrl = \`\${baseUrl}/reset-password?token=\${token}\``
).replace(
  /function createEmailVerificationEmail\(email, token\) {/,
  `function createEmailVerificationEmail(email, token) {
    // Sanitize frontend URL
    const baseUrl = sanitizeUrl(process.env.FRONTEND_URL || 'https://app.ciroai.us');`
).replace(
  /const verificationUrl = `\$\{process.env.FRONTEND_URL\}\/verify-email\?token=\$\{token\}`/g,
  `const verificationUrl = \`\${baseUrl}/verify-email?token=\${token}\``
);

// Create the hotfix folder if it doesn't exist
const hotfixDir = path.join(__dirname, 'hotfix');
if (!fs.existsSync(hotfixDir)) {
  fs.mkdirSync(hotfixDir, { recursive: true });
}

// Save the fixed file
const fixedFilePath = path.join(hotfixDir, 'sendgrid.js');
fs.writeFileSync(fixedFilePath, fixedContent);

console.log(`Original file: ${originalFilePath}`);
console.log(`Fixed file created at: ${fixedFilePath}`);
console.log('\nTo apply this hotfix, you need to:');
console.log('1. Copy the fixed file to the S3 bucket');
console.log('2. Create a script to be executed on the ECS container to download and replace the file');
console.log('3. Use AWS Systems Manager Run Command or ECS Exec to execute the script');
console.log('\nAlternatively, proceed with the full deployment fix which is already in progress.');

// Output the fixed content for reference
console.log('\n--- Fixed Content Preview ---');
console.log(fixedContent.substring(0, 500) + '...'); 