#!/bin/bash
# Script to set up AWS resources for deployment

# Exit on error
set -e

# Default variables
AWS_REGION="us-east-1"
STACK_NAME="ciro-stack"
ECR_REPO_BACKEND="ciro-backend"
ECR_REPO_FRONTEND="ciro-frontend"
RDS_INSTANCE_NAME="ciro-db"
RDS_DB_NAME="ciro_db"
RDS_USERNAME="***REMOVED***"
ECS_CLUSTER_NAME="ciro-cluster"

# Parse command line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=== Setting up AWS resources in region $AWS_REGION ==="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
aws sts get-caller-identity

# Create ECR repositories
echo "Creating ECR repositories..."
aws ecr create-repository --repository-name $ECR_REPO_BACKEND --region $AWS_REGION || echo "Repository $ECR_REPO_BACKEND already exists"
aws ecr create-repository --repository-name $ECR_REPO_FRONTEND --region $AWS_REGION || echo "Repository $ECR_REPO_FRONTEND already exists"

# Create VPC
echo "Creating VPC resources..."
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value='"$STACK_NAME"'-vpc}]' --query Vpc.VpcId --output text --region $AWS_REGION)
echo "Created VPC: $VPC_ID"

# Create subnets
echo "Creating subnets..."
SUBNET1_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${AWS_REGION}a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value='"$STACK_NAME"'-subnet-1}]' --query Subnet.SubnetId --output text --region $AWS_REGION)
SUBNET2_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${AWS_REGION}b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value='"$STACK_NAME"'-subnet-2}]' --query Subnet.SubnetId --output text --region $AWS_REGION)
echo "Created subnets: $SUBNET1_ID, $SUBNET2_ID"

# Create internet gateway
echo "Creating internet gateway..."
IGW_ID=$(aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value='"$STACK_NAME"'-igw}]' --query InternetGateway.InternetGatewayId --output text --region $AWS_REGION)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION
echo "Created and attached internet gateway: $IGW_ID"

# Create route table
echo "Setting up routing..."
RTB_ID=$(aws ec2 create-route-table --vpc-id $VPC_ID --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value='"$STACK_NAME"'-rtb}]' --query RouteTable.RouteTableId --output text --region $AWS_REGION)
aws ec2 create-route --route-table-id $RTB_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID --region $AWS_REGION
aws ec2 associate-route-table --route-table-id $RTB_ID --subnet-id $SUBNET1_ID --region $AWS_REGION
aws ec2 associate-route-table --route-table-id $RTB_ID --subnet-id $SUBNET2_ID --region $AWS_REGION
echo "Created and configured route table: $RTB_ID"

# Create security groups
echo "Creating security groups..."
SG_RDS_ID=$(aws ec2 create-security-group --group-name "$STACK_NAME-rds-sg" --description "$STACK_NAME RDS security group" --vpc-id $VPC_ID --query GroupId --output text --region $AWS_REGION)
SG_ECS_ID=$(aws ec2 create-security-group --group-name "$STACK_NAME-ecs-sg" --description "$STACK_NAME ECS security group" --vpc-id $VPC_ID --query GroupId --output text --region $AWS_REGION)
SG_ALB_ID=$(aws ec2 create-security-group --group-name "$STACK_NAME-alb-sg" --description "$STACK_NAME ALB security group" --vpc-id $VPC_ID --query GroupId --output text --region $AWS_REGION)

# Configure security group rules
aws ec2 authorize-security-group-ingress --group-id $SG_RDS_ID --protocol tcp --port 5432 --source-group $SG_ECS_ID --region $AWS_REGION
aws ec2 authorize-security-group-ingress --group-id $SG_ECS_ID --protocol tcp --port 3001 --source-group $SG_ALB_ID --region $AWS_REGION
aws ec2 authorize-security-group-ingress --group-id $SG_ALB_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $AWS_REGION
aws ec2 authorize-security-group-ingress --group-id $SG_ALB_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $AWS_REGION
echo "Created and configured security groups: $SG_RDS_ID, $SG_ECS_ID, $SG_ALB_ID"

# Create ECS Cluster
echo "Creating ECS cluster..."
aws ecs create-cluster --cluster-name $ECS_CLUSTER_NAME --region $AWS_REGION
echo "Created ECS cluster: $ECS_CLUSTER_NAME"

# Create S3 bucket for frontend
S3_BUCKET_NAME="$STACK_NAME-frontend-$(date +%s)"
echo "Creating S3 bucket for frontend..."
aws s3 mb s3://$S3_BUCKET_NAME --region $AWS_REGION
aws s3 website s3://$S3_BUCKET_NAME --index-document index.html --error-document index.html
BUCKET_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::'$S3_BUCKET_NAME'/*"
    }
  ]
}'
echo "$BUCKET_POLICY" > bucket-policy.json
aws s3api put-bucket-policy --bucket $S3_BUCKET_NAME --policy file://bucket-policy.json
rm bucket-policy.json
echo "Created S3 bucket: $S3_BUCKET_NAME"

# Output configuration details
echo "=== AWS Resources Created ==="
echo "Region: $AWS_REGION"
echo "VPC ID: $VPC_ID"
echo "Subnet IDs: $SUBNET1_ID, $SUBNET2_ID"
echo "Security Groups:"
echo "  - RDS: $SG_RDS_ID"
echo "  - ECS: $SG_ECS_ID"
echo "  - ALB: $SG_ALB_ID"
echo "ECR Repositories:"
echo "  - Backend: $ECR_REPO_BACKEND"
echo "  - Frontend: $ECR_REPO_FRONTEND"
echo "ECS Cluster: $ECS_CLUSTER_NAME"
echo "S3 Bucket for Frontend: $S3_BUCKET_NAME"

# Save configuration for later use
cat > aws-config.env << EOF
AWS_REGION=$AWS_REGION
STACK_NAME=$STACK_NAME
VPC_ID=$VPC_ID
SUBNET1_ID=$SUBNET1_ID
SUBNET2_ID=$SUBNET2_ID
SG_RDS_ID=$SG_RDS_ID
SG_ECS_ID=$SG_ECS_ID
SG_ALB_ID=$SG_ALB_ID
ECR_REPO_BACKEND=$ECR_REPO_BACKEND
ECR_REPO_FRONTEND=$ECR_REPO_FRONTEND
ECS_CLUSTER_NAME=$ECS_CLUSTER_NAME
S3_BUCKET_NAME=$S3_BUCKET_NAME
EOF

echo "Configuration saved to aws-config.env"
echo "Next steps:"
echo "1. Create RDS database instance with: ./create-rds.sh"
echo "2. Build and push Docker images with: ./build-and-push.sh"
echo "3. Deploy services with: ./deploy-services.sh"

echo "Done!" 