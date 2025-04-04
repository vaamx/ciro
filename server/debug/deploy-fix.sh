#!/bin/bash
# Simple script to fix the deployment issue

# Exit on error
set -e

# Load AWS configuration
cd /home/vaamx/ciro-1/aws-deployment
source aws-config.env

# Basic info
echo "Fixing backend deployment"
echo "AWS Region: $AWS_REGION"
echo "ECR Repo: $ECR_REPO_BACKEND"
echo "ECS Cluster: $ECS_CLUSTER_NAME"
echo "Service Name: ciro-stack-backend"

# Step 1: Build the Docker image locally
cd /home/vaamx/ciro-1/server
echo "Building Docker image..."
docker build -t ciro-backend-fix .

# Step 2: Push to ECR
echo "Logging in to ECR..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag the image
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
BACKEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:$IMAGE_TAG"
echo "Tagging image as: $BACKEND_IMAGE_URI"
docker tag ciro-backend-fix $BACKEND_IMAGE_URI

# Push the image
echo "Pushing image to ECR..."
docker push $BACKEND_IMAGE_URI

# Step 3: Update task definition
echo "Creating new task definition..."

# Get the current task definition (the one that works)
WORKING_TASK_DEF_ARN=$(aws ecs describe-tasks \
  --cluster $ECS_CLUSTER_NAME \
  --tasks arn:aws:ecs:us-east-1:794038226747:task/ciro-cluster/c2ac47c424024afea4e26649c6efc059 \
  --query 'tasks[0].taskDefinitionArn' \
  --output text)

# Get task definition details we need to keep
TASK_DEF_DETAILS=$(aws ecs describe-task-definition \
  --task-definition $WORKING_TASK_DEF_ARN \
  --query 'taskDefinition.{
    family: family,
    networkMode: networkMode,
    executionRoleArn: executionRoleArn,
    taskRoleArn: taskRoleArn,
    cpu: cpu,
    memory: memory,
    volumes: volumes
  }' \
  --output json)

# Get container definitions but replace the image URI
CONTAINER_DEFS=$(aws ecs describe-task-definition \
  --task-definition $WORKING_TASK_DEF_ARN \
  --query 'taskDefinition.containerDefinitions' \
  --output json)

# Create a temporary file with updated container definitions
TEMP_CONTAINER_DEFS=$(mktemp)
echo "$CONTAINER_DEFS" | jq --arg IMAGE "$BACKEND_IMAGE_URI" '
  map(
    if .name == "backend" then 
      . + {"image": $IMAGE, 
           "environment": [
             .environment[] | 
             if .name == "FRONTEND_URL" then 
               {"name": "FRONTEND_URL", "value": "https://app.ciroai.us"} 
             else . 
             end
           ]
          } 
    else . 
    end
  )
' > $TEMP_CONTAINER_DEFS

# Create a temporary task definition file
TEMP_TASK_DEF=$(mktemp)
echo "$TASK_DEF_DETAILS" | jq --slurpfile CONTAINERS "$TEMP_CONTAINER_DEFS" '
  . + {
    "containerDefinitions": $CONTAINERS[0],
    "requiresCompatibilities": ["FARGATE"]
  }
' > $TEMP_TASK_DEF

# Register the new task definition
echo "Registering task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://$TEMP_TASK_DEF \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# Clean up temporary files
rm $TEMP_CONTAINER_DEFS $TEMP_TASK_DEF

echo "New task definition: $NEW_TASK_DEF_ARN"

# Update the service with the new task definition
echo "Updating ECS service..."
aws ecs update-service \
  --cluster $ECS_CLUSTER_NAME \
  --service ciro-stack-backend \
  --task-definition $NEW_TASK_DEF_ARN \
  --force-new-deployment

echo "Deployment initiated. Monitor the status in AWS Console."
echo "Done!" 