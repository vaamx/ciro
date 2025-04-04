#!/bin/bash
# Ultimate deployment script that matches the working Docker image configuration

# Exit on error
set -e

# Load AWS configuration
cd /home/vaamx/ciro-1/aws-deployment
source aws-config.env

# Basic info
echo "Deploying backend with ultimate fix"
echo "AWS Region: $AWS_REGION"
echo "ECR Repo: $ECR_REPO_BACKEND"
echo "ECS Cluster: $ECS_CLUSTER_NAME"
echo "Service Name: ciro-stack-backend"

# Step 1: Build the Docker image with the updated Dockerfile
cd /home/vaamx/ciro-1/server
echo "Building Docker image..."
docker build -t ciro-backend-ultimate .

# Step 2: Push to ECR
echo "Logging in to ECR..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag the image
IMAGE_TAG="ultimate-$(date +%Y%m%d-%H%M%S)"
BACKEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:$IMAGE_TAG"
echo "Tagging image as: $BACKEND_IMAGE_URI"
docker tag ciro-backend-ultimate $BACKEND_IMAGE_URI

# Push the image
echo "Pushing image to ECR..."
docker push $BACKEND_IMAGE_URI

# Step 3: Get current task definition that is working
echo "Getting working task definition..."
WORKING_TASK_DEF_ARN="arn:aws:ecs:us-east-1:794038226747:task-definition/ciro-stack-backend:21"
echo "Working task definition: $WORKING_TASK_DEF_ARN"

# Get current task definition JSON
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition $WORKING_TASK_DEF_ARN \
  --query 'taskDefinition' \
  --output json)

# Extract container definitions
CONTAINER_DEFS=$(echo "$CURRENT_TASK_DEF" | jq '.containerDefinitions')

# Update the backend container image in the container definitions
UPDATED_CONTAINER_DEFS=$(echo "$CONTAINER_DEFS" | jq --arg IMAGE "$BACKEND_IMAGE_URI" '
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
')

# Register a new task definition with the updated container definitions
echo "Registering new task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --family $(echo "$CURRENT_TASK_DEF" | jq -r '.family') \
  --execution-role-arn $(echo "$CURRENT_TASK_DEF" | jq -r '.executionRoleArn') \
  --task-role-arn $(echo "$CURRENT_TASK_DEF" | jq -r '.taskRoleArn') \
  --network-mode $(echo "$CURRENT_TASK_DEF" | jq -r '.networkMode') \
  --volumes "$(echo "$CURRENT_TASK_DEF" | jq '.volumes')" \
  --cpu $(echo "$CURRENT_TASK_DEF" | jq -r '.cpu') \
  --memory $(echo "$CURRENT_TASK_DEF" | jq -r '.memory') \
  --requires-compatibilities $(echo "$CURRENT_TASK_DEF" | jq -r '.requiresCompatibilities[0]') \
  --container-definitions "$UPDATED_CONTAINER_DEFS" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "New task definition: $NEW_TASK_DEF_ARN"

# Update the service with the new task definition
echo "Updating ECS service..."
aws ecs update-service \
  --cluster $ECS_CLUSTER_NAME \
  --service ciro-stack-backend \
  --task-definition $NEW_TASK_DEF_ARN \
  --force-new-deployment

echo "Deployment initiated. You can monitor the status in AWS Console."
echo "Once the deployment completes, the backend will be available at: https://api.ciroai.us"
echo "Done!" 