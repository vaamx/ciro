/**
 * This script creates a fixed version of sendgrid.js that properly handles 
 * URL sanitization for email links
 */

const fs = require('fs');
const path = require('path');

// Create a fixed version of the SendGrid service with proper URL handling
const patchedSendgridContent = `"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGridService = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));

// Helper function to ensure URL has proper format
function sanitizeUrl(url) {
  if (!url) return 'https://app.ciroai.us';
  
  // Remove trailing slashes
  let sanitized = url.trim().replace(/\\/+$/, '');
  
  // Ensure URL has http/https protocol
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    sanitized = 'https://' + sanitized;
  }
  
  return sanitized;
}

class SendGridService {
    testMode = false;
    constructor() {
        if (!process.env.SENDGRID_API_KEY) {
            console.warn('SendGrid API key not configured. Email functionality will be disabled.');
            this.testMode = true;
            return;
        }
        mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
    }
    async sendEmail(to, subject, html, from = process.env.FROM_EMAIL || 'noreply@ciroai.us') {
        if (this.testMode) {
            console.log('SendGrid in test mode. Email not sent.');
            console.log('To:', to);
            console.log('Subject:', subject);
            return { success: true };
        }
        try {
            const msg = {
                to,
                from,
                subject,
                html,
            };
            await mail_1.default.send(msg);
            return { success: true };
        }
        catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error };
        }
    }
    async sendPasswordResetEmail(email, token) {
        const emailContent = createPasswordResetEmail(email, token);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
    async sendVerificationEmail(email, token) {
        const emailContent = createEmailVerificationEmail(email, token);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
    async sendWelcomeEmail(email, name) {
        const emailContent = createWelcomeEmail(email, name);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
}
exports.SendGridService = SendGridService;

function createPasswordResetEmail(email, token) {
    // Sanitize the frontend URL
    const baseUrl = sanitizeUrl(process.env.FRONTEND_URL);
    const resetUrl = \`\${baseUrl}/reset-password?token=\${token}\`;
    return {
        subject: 'Reset Your Password',
        html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <p><a href="\${resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser: <a href="\${resetUrl}">\${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thank you,<br>The CIRO AI Team</p>
      </div>
    \`
    };
}

function createEmailVerificationEmail(email, token) {
    // Sanitize the frontend URL
    const baseUrl = sanitizeUrl(process.env.FRONTEND_URL);
    const verificationUrl = \`\${baseUrl}/verify-email?token=\${token}\`;
    return {
        subject: 'Verify Your Email Address',
        html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email Address</h2>
        <p>Hello,</p>
        <p>Thank you for registering with us. Please click the link below to verify your email address:</p>
        <p><a href="\${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser: <a href="\${verificationUrl}">\${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>Thank you,<br>The CIRO AI Team</p>
      </div>
    \`
    };
}

function createWelcomeEmail(email, name) {
    return {
        subject: 'Welcome to CIRO AI',
        html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to CIRO AI!</h2>
        <p>Hello \${name || 'there'},</p>
        <p>Thank you for joining CIRO AI. We're excited to have you on board!</p>
        <p>With CIRO AI, you can:</p>
        <ul>
          <li>Connect to your data sources</li>
          <li>Chat with your data using AI</li>
          <li>Generate insights and visualizations</li>
          <li>Build custom dashboards</li>
        </ul>
        <p>If you have any questions or need assistance, feel free to reply to this email.</p>
        <p>Best regards,<br>The CIRO AI Team</p>
      </div>
    \`
    };
}
`;

// Create the hotfix folder if it doesn't exist
const hotfixDir = path.join(__dirname, 'hotfix');
if (!fs.existsSync(hotfixDir)) {
  fs.mkdirSync(hotfixDir, { recursive: true });
}

// Save the fixed file
const fixedFilePath = path.join(hotfixDir, 'sendgrid.js');
fs.writeFileSync(fixedFilePath, patchedSendgridContent);

// Create a deployment script to apply this patch
const deploymentScript = `#!/bin/bash
# Script to apply the sendgrid.js hotfix to a running ECS container

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "AWS CLI is not installed. Please install it first."
  exit 1
fi

# AWS S3 bucket to use for the hotfix
S3_BUCKET="ciro-hotfixes"

# Upload the fixed file to S3
echo "Uploading fixed sendgrid.js to S3..."
aws s3 cp ./hotfix/sendgrid.js s3://$S3_BUCKET/hotfixes/sendgrid.js

# Create the apply-fix script
cat > ./hotfix/apply-fix.sh << 'EOF'
#!/bin/bash
# Script to be executed inside the ECS container

# Target location for the fixed file
TARGET_FILE="/app/dist/src/infrastructure/email/sendgrid.js"

# Create a backup of the original file
cp $TARGET_FILE ${TARGET_FILE}.bak

# Download the fixed file from S3
aws s3 cp s3://ciro-hotfixes/hotfixes/sendgrid.js $TARGET_FILE

# Verify the file was updated
ls -la $TARGET_FILE
echo "File updated successfully!"

# Restart the Node.js process to apply the changes
# Note: This may cause a brief service interruption
if pgrep node > /dev/null; then
  pkill -HUP node
  echo "Node.js process restarted."
fi
EOF

# Upload the apply-fix script to S3
echo "Uploading apply-fix.sh to S3..."
aws s3 cp ./hotfix/apply-fix.sh s3://$S3_BUCKET/hotfixes/apply-fix.sh

echo "Hotfix files uploaded to S3. Ready to apply to ECS container."
echo "Use one of the following methods to apply the hotfix:"
echo "1. AWS Systems Manager Run Command to execute the script on the EC2 instances running the containers"
echo "2. If ECS Exec is available, use it to connect to the container and apply the fix manually"

# Instructions for running the fix manually via ECS Exec
echo ""
echo "Manual ECS Exec commands:"
echo "------------------------"
echo "1. First, get the task ID:"
echo "   aws ecs list-tasks --cluster ciro-cluster --service ciro-stack-backend"
echo ""
echo "2. Execute the commands to apply the fix:"
echo "   aws ecs execute-command --cluster ciro-cluster --task TASK_ID --container backend --interactive --command '/bin/bash'"
echo ""
echo "3. Inside the container shell, run:"
echo "   mkdir -p /tmp/hotfix"
echo "   aws s3 cp s3://ciro-hotfixes/hotfixes/sendgrid.js /tmp/hotfix/sendgrid.js"
echo "   cp /app/dist/src/infrastructure/email/sendgrid.js /app/dist/src/infrastructure/email/sendgrid.js.bak"
echo "   cp /tmp/hotfix/sendgrid.js /app/dist/src/infrastructure/email/sendgrid.js"
echo "   echo 'Hotfix applied!'"
echo ""
echo "4. To verify the fix, restart the Node process or wait for new email verifications to be sent."
`;

// Save the deployment script
const deploymentScriptPath = path.join(hotfixDir, 'deploy-hotfix.sh');
fs.writeFileSync(deploymentScriptPath, deploymentScript, { mode: 0o755 });

console.log(`Fixed SendGrid file created at: ${fixedFilePath}`);
console.log(`Deployment script created at: ${deploymentScriptPath}`);
console.log('\nTo apply this hotfix:');
console.log(`1. Make the deployment script executable: chmod +x ${deploymentScriptPath}`);
console.log(`2. Run the deployment script: ${deploymentScriptPath}`);
console.log('3. Follow the instructions provided by the script');
console.log('\nAlternatively, wait for the full deployment fix which is already in progress.'); 