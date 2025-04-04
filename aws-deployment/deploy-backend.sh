#!/bin/bash
# ============================================================
# CIRO Backend Deployment Script
# ============================================================
# This script handles backend deployments to AWS ECS
# It builds the Docker image, pushes to ECR, and updates the ECS service
# ============================================================

# Exit on error
set -e

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================
# CONFIGURATION
# ============================================================

# Load AWS configuration if available
if [ -f aws-config.env ]; then
  source aws-config.env
  echo -e "${GREEN}✓${NC} Loaded AWS configuration from aws-config.env"
else
  # Hardcoded fallback values
  AWS_REGION="us-east-1"
  STACK_NAME="ciro-stack"
  ECS_CLUSTER_NAME="ciro-cluster"
  ECR_REPO_BACKEND="ciro-backend"
  echo -e "${YELLOW}!${NC} Using hardcoded configuration values"
fi

# Set derived values
BACKEND_SERVICE_NAME="${STACK_NAME}-backend"
TASK_FAMILY="${STACK_NAME}-backend"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Set paths
WORKSPACE_DIR="/home/vaamx/ciro-1"
SERVER_DIR="${WORKSPACE_DIR}/server"

# ============================================================
# COMMAND LINE ARGUMENTS
# ============================================================

# Parse arguments
SKIP_BUILD=false
SKIP_PUSH=false
SKIP_DEPLOY=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-push)
      SKIP_PUSH=true
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --help)
      echo -e "${BOLD}CIRO Backend Deployment Script${NC}"
      echo ""
      echo "Usage: ./deploy-backend.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip Docker build step"
      echo "  --skip-push     Skip Docker push to ECR step"
      echo "  --skip-deploy   Skip ECS service update step"
      echo "  --help          Display this help message"
      echo ""
      exit 0
      ;;
  esac
done

# ============================================================
# DEPLOYMENT PROCESS
# ============================================================

echo -e "\n${BOLD}=== CIRO Backend Deployment ===${NC}\n"
echo -e "AWS Account: ${BOLD}$AWS_ACCOUNT_ID${NC}"
echo -e "Region: ${BOLD}$AWS_REGION${NC}"
echo -e "ECS Cluster: ${BOLD}$ECS_CLUSTER_NAME${NC}"
echo -e "Service: ${BOLD}$BACKEND_SERVICE_NAME${NC}"
echo -e "ECR Repository: ${BOLD}$ECR_REPO_BACKEND${NC}"

# Step 1: Build Docker image
if [ "$SKIP_BUILD" = false ]; then
  echo -e "\n${BOLD}Step 1:${NC} Building backend Docker image..."
  cd $SERVER_DIR
  docker build -t $ECR_REPO_BACKEND:latest .
  echo -e "${GREEN}✓${NC} Docker image built successfully"
else
  echo -e "\n${YELLOW}!${NC} Skipping Docker build step as requested"
fi

# Step 2: Push to ECR
if [ "$SKIP_PUSH" = false ]; then
  echo -e "\n${BOLD}Step 2:${NC} Pushing image to ECR..."
  
  # Login to ECR
  echo -e "   • Logging in to ECR..."
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
  
  # Tag the image
  BACKEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:latest"
  echo -e "   • Tagging image as: ${BOLD}$BACKEND_IMAGE_URI${NC}"
  docker tag $ECR_REPO_BACKEND:latest $BACKEND_IMAGE_URI
  
  # Push the image
  echo -e "   • Pushing image to ECR..."
  docker push $BACKEND_IMAGE_URI
  
  # Update image URI in config
  if [ -f aws-config.env ]; then
    # Remove existing BACKEND_IMAGE_URI if exists
    sed -i '/BACKEND_IMAGE_URI=/d' aws-config.env
    # Add new BACKEND_IMAGE_URI
    echo "BACKEND_IMAGE_URI=$BACKEND_IMAGE_URI" >> aws-config.env
  fi
  
  echo -e "${GREEN}✓${NC} Docker image pushed to ECR successfully"
else
  echo -e "\n${YELLOW}!${NC} Skipping Docker push step as requested"
fi

# Step 3: Update ECS Service
if [ "$SKIP_DEPLOY" = false ]; then
  echo -e "\n${BOLD}Step 3:${NC} Updating ECS service..."
  
  # Get current task definition
  echo -e "   • Retrieving current task definition..."
  TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER_NAME \
    --services $BACKEND_SERVICE_NAME \
    --query "services[0].taskDefinition" \
    --output text \
    --region $AWS_REGION)
  echo -e "   • Current task definition: ${BOLD}$TASK_DEF_ARN${NC}"
  
  # Extract task definition details
  echo -e "   • Extracting task definition details..."
  CONTAINER_DEFS=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.containerDefinitions" \
    --output json \
    --region $AWS_REGION)
  
  # Get volumes configuration
  VOLUMES=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.volumes" \
    --output json \
    --region $AWS_REGION)
  
  # Get other required task definition parameters
  NETWORK_MODE=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.networkMode" \
    --output text \
    --region $AWS_REGION)
  
  EXECUTION_ROLE_ARN=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.executionRoleArn" \
    --output text \
    --region $AWS_REGION)
  
  TASK_ROLE_ARN=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.taskRoleArn" \
    --output text \
    --region $AWS_REGION)
  
  CPU=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.cpu" \
    --output text \
    --region $AWS_REGION)
  
  MEMORY=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query "taskDefinition.memory" \
    --output text \
    --region $AWS_REGION)
  
  # Create a temporary JSON file for the new task definition
  echo -e "   • Creating new task definition from template..."
  TEMP_TASK_DEF=$(mktemp)
  cat > $TEMP_TASK_DEF << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "$NETWORK_MODE",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "cpu": "$CPU",
  "memory": "$MEMORY",
  "containerDefinitions": $CONTAINER_DEFS,
  "volumes": $VOLUMES,
  "requiresCompatibilities": [
    "FARGATE"
  ]
}
EOF
  
  # Register the new task definition
  echo -e "   • Registering new task definition..."
  NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://$TEMP_TASK_DEF \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region $AWS_REGION)
  
  # Clean up temp file
  rm $TEMP_TASK_DEF
  
  echo -e "   • New task definition: ${BOLD}$NEW_TASK_DEF_ARN${NC}"
  
  # Update the service with the new task definition
  echo -e "   • Updating service with new task definition..."
  aws ecs update-service \
    --cluster $ECS_CLUSTER_NAME \
    --service $BACKEND_SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --force-new-deployment \
    --region $AWS_REGION
  
  echo -e "   • Waiting for deployment to complete (this may take several minutes)..."
  aws ecs wait services-stable \
    --cluster $ECS_CLUSTER_NAME \
    --services $BACKEND_SERVICE_NAME \
    --region $AWS_REGION
  
  echo -e "${GREEN}✓${NC} ECS service updated successfully"
else
  echo -e "\n${YELLOW}!${NC} Skipping ECS service update step as requested"
fi

# ============================================================
# DEPLOYMENT SUMMARY
# ============================================================

echo -e "\n${BOLD}=== Deployment Complete ===${NC}\n"
echo -e "${GREEN}✓${NC} Backend deployed successfully to ECS"
echo -e "\n${BOLD}Verification Steps:${NC}"
echo -e "1. Check service status in AWS ECS console"
echo -e "2. Verify API endpoints at ${BOLD}https://api.ciroai.us${NC}"
echo -e "\n${BOLD}Use the verification script:${NC}"
echo -e "./verify-deployment.sh --backend\n" 