#!/bin/bash
# Script to build and push Docker images to ECR

# Exit on error
set -e

# Load configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh first."
    exit 1
fi

source aws-config.env

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Building and pushing Docker images to ECR ==="
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "ECR Backend Repository: $ECR_REPO_BACKEND"
echo "ECR Frontend Repository: $ECR_REPO_FRONTEND"

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend image
echo "Building backend image..."
cd ../server
docker build -t $ECR_REPO_BACKEND:latest .

echo "Tagging backend image..."
docker tag $ECR_REPO_BACKEND:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:latest

echo "Pushing backend image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:latest

# Build and push frontend image
echo "Building frontend image..."
cd ../dashboard
docker build -t $ECR_REPO_FRONTEND:latest .

echo "Tagging frontend image..."
docker tag $ECR_REPO_FRONTEND:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_FRONTEND:latest

echo "Pushing frontend image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_FRONTEND:latest

# Return to original directory
cd ../aws-deployment

# Update configuration with image URIs
BACKEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND:latest"
FRONTEND_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_FRONTEND:latest"

cat >> aws-config.env << EOF
BACKEND_IMAGE_URI=$BACKEND_IMAGE_URI
FRONTEND_IMAGE_URI=$FRONTEND_IMAGE_URI
EOF

echo "Image URIs saved to aws-config.env"

echo "Images built and pushed successfully!"
echo "Backend image: $BACKEND_IMAGE_URI"
echo "Frontend image: $FRONTEND_IMAGE_URI"
echo "Done!" 