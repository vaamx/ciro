#!/bin/bash
# Script to apply the sendgrid.js hotfix to a running ECS container

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "AWS CLI is not installed. Please install it first."
  exit 1
fi

# AWS S3 bucket to use for the hotfix
S3_BUCKET="ciro-hotfixes"

# Check if the bucket exists, if not create it
aws s3 ls s3://$S3_BUCKET > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Creating S3 bucket for hotfixes..."
  aws s3 mb s3://$S3_BUCKET
fi

# Upload the fixed file to S3
echo "Uploading fixed sendgrid.js to S3..."
aws s3 cp ./sendgrid.js s3://$S3_BUCKET/hotfixes/sendgrid.js

# Upload the apply-fix script to S3
echo "Uploading apply-fix.sh to S3..."
aws s3 cp ./apply-fix.sh s3://$S3_BUCKET/hotfixes/apply-fix.sh

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