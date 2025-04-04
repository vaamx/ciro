#!/bin/bash
# Fixed deployment script for the backend

# Exit on error
set -e

# Load AWS configuration
cd /home/vaamx/ciro-1/aws-deployment
source aws-config.env

# Basic info
echo "Deploying fixed backend"
echo "AWS Region: $AWS_REGION"
echo "ECR Repo: $ECR_REPO_BACKEND"
echo "ECS Cluster: $ECS_CLUSTER_NAME"
echo "Service Name: ciro-stack-backend"

# Step 1: Build the Docker image locally with updated Dockerfile
cd /home/vaamx/ciro-1/server
echo "Building Docker image..."
docker build -t ciro-backend-fixed .

# Step 2: Push to ECR
echo "Logging in to ECR..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag the image
IMAGE_TAG="fixed-$(date +%Y%m%d-%H%M%S)"
BACKEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:$IMAGE_TAG"
echo "Tagging image as: $BACKEND_IMAGE_URI"
docker tag ciro-backend-fixed $BACKEND_IMAGE_URI

# Push the image
echo "Pushing image to ECR..."
docker push $BACKEND_IMAGE_URI

# Step 3: Update task definition to use our new image
echo "Creating new task definition..."

# Get the current task definition
TASK_FAMILY="ciro-stack-backend"
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition $TASK_FAMILY \
  --query 'taskDefinition' \
  --output json)

# Update the container image in the task definition
TEMP_TASK_DEF=$(mktemp)
echo "$CURRENT_TASK_DEF" | jq --arg IMAGE "$BACKEND_IMAGE_URI" '
  .containerDefinitions |= map(
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
' > $TEMP_TASK_DEF

# Register the new task definition
echo "Registering task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --family $TASK_FAMILY \
  --execution-role-arn $(echo "$CURRENT_TASK_DEF" | jq -r '.executionRoleArn') \
  --task-role-arn $(echo "$CURRENT_TASK_DEF" | jq -r '.taskRoleArn') \
  --network-mode $(echo "$CURRENT_TASK_DEF" | jq -r '.networkMode') \
  --cpu $(echo "$CURRENT_TASK_DEF" | jq -r '.cpu') \
  --memory $(echo "$CURRENT_TASK_DEF" | jq -r '.memory') \
  --requires-compatibilities $(echo "$CURRENT_TASK_DEF" | jq -r '.requiresCompatibilities[]') \
  --container-definitions "$(cat $TEMP_TASK_DEF | jq '.containerDefinitions')" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# Clean up temporary files
rm $TEMP_TASK_DEF

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