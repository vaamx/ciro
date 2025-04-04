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