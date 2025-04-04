#!/bin/bash
# Script to deploy Prisma migrations to AWS RDS through SSM Run Command
# This approach avoids network connectivity issues from your local machine

# Exit on error
set -e

# Load AWS configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh and create-rds.sh first."
    exit 1
fi

source aws-config.env

echo "=== Deploying Prisma Migrations to AWS RDS through SSM ==="
echo "RDS endpoint: $RDS_ENDPOINT"
echo "Database: $RDS_DB_NAME"
echo "Username: $RDS_USERNAME"

# First, find all running ECS tasks in our cluster
echo "Looking for running ECS tasks..."
TASK_ARN=$(aws ecs list-tasks --cluster $ECS_CLUSTER_NAME --desired-status RUNNING --query 'taskArns[0]' --output text)

if [ "$TASK_ARN" == "None" ]; then
    echo "No running ECS tasks found. We need a running container to execute migrations."
    echo "Would you like to:"
    echo "1. Deploy services first, then run migrations"
    echo "2. Abort and run migrations manually later"
    read -p "Enter choice (1/2): " choice
    
    if [ "$choice" == "1" ]; then
        echo "Deploying services first..."
        ./deploy-services.sh
        TASK_ARN=$(aws ecs list-tasks --cluster $ECS_CLUSTER_NAME --desired-status RUNNING --query 'taskArns[0]' --output text)
    else
        echo "Aborting migration deployment."
        exit 0
    fi
fi

# Get the task details to find the container
TASK_ID=$(echo $TASK_ARN | cut -d'/' -f3)
echo "Found running task: $TASK_ID"

# Execute the migration command inside the container
echo "Executing Prisma migrations inside the task container..."

# Create migration command - setting DATABASE_URL and running prisma migrate deploy
MIGRATION_CMD="cd /app && DATABASE_URL=\"***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public\" npx prisma migrate deploy"

# Run the migration command in the container
aws ecs execute-command \
    --cluster $ECS_CLUSTER_NAME \
    --task $TASK_ARN \
    --container backend \
    --interactive \
    --command "/bin/bash -c '$MIGRATION_CMD'"

echo "Migrations completed!" 