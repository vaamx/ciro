#!/bin/bash
# Script to deploy services to AWS ECS

# Exit on error
set -e

# Load configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh first."
    exit 1
fi

source aws-config.env

# Check if backend image URI exists
if [ -z "$BACKEND_IMAGE_URI" ]; then
    echo "Backend image URI not found. Run build-and-push.sh first."
    exit 1
fi

# Required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "OPENAI_API_KEY environment variable is required. Please set it before running this script."
    exit 1
fi

echo "=== Deploying services to AWS ECS ==="
echo "Cluster: $ECS_CLUSTER_NAME"
echo "Backend image: $BACKEND_IMAGE_URI"
echo "RDS endpoint: $RDS_ENDPOINT"

# Create task execution role
echo "Creating task execution role..."
aws iam create-role \
    --role-name ${STACK_NAME}-task-execution-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' \
    --region $AWS_REGION

aws iam attach-role-policy \
    --role-name ${STACK_NAME}-task-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
    --region $AWS_REGION

# Create ECS task role for application permissions
echo "Creating task role..."
aws iam create-role \
    --role-name ${STACK_NAME}-task-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' \
    --region $AWS_REGION

aws iam attach-role-policy \
    --role-name ${STACK_NAME}-task-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
    --region $AWS_REGION

# Get role ARNs
TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-execution-role --query "Role.Arn" --output text --region $AWS_REGION)
TASK_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-role --query "Role.Arn" --output text --region $AWS_REGION)

# Create EFS for Qdrant data persistence
echo "Creating EFS filesystem..."
EFS_ID=$(aws efs create-file-system \
    --performance-mode generalPurpose \
    --throughput-mode bursting \
    --encrypted \
    --tags Key=Name,Value=${STACK_NAME}-qdrant-data \
    --query "FileSystemId" \
    --output text \
    --region $AWS_REGION)

# Wait for EFS to be available
echo "Waiting for EFS to become available..."
aws efs wait file-system-available \
    --file-system-id $EFS_ID \
    --region $AWS_REGION

# Create mount targets in each subnet
echo "Creating EFS mount targets..."
aws efs create-mount-target \
    --file-system-id $EFS_ID \
    --subnet-id $SUBNET1_ID \
    --security-groups $SG_ECS_ID \
    --region $AWS_REGION

aws efs create-mount-target \
    --file-system-id $EFS_ID \
    --subnet-id $SUBNET2_ID \
    --security-groups $SG_ECS_ID \
    --region $AWS_REGION

# Create EFS access point
echo "Creating EFS access point..."
EFS_ACCESS_POINT_ID=$(aws efs create-access-point \
    --file-system-id $EFS_ID \
    --posix-user "Uid=1000,Gid=1000" \
    --root-directory "Path=/qdrant_data,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=755}" \
    --query "AccessPointId" \
    --output text \
    --region $AWS_REGION)

# Create ALB
echo "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name ${STACK_NAME}-alb \
    --subnets $SUBNET1_ID $SUBNET2_ID \
    --security-groups $SG_ALB_ID \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text \
    --region $AWS_REGION)

# Wait for ALB to be available
echo "Waiting for ALB to become available..."
aws elbv2 wait load-balancer-available \
    --load-balancer-arns $ALB_ARN \
    --region $AWS_REGION

# Create target group for backend
echo "Creating target group for backend..."
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
    --name ${STACK_NAME}-backend-tg \
    --protocol HTTP \
    --port 3001 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 2 \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text \
    --region $AWS_REGION)

# Create listener for HTTP
echo "Creating ALB listener..."
LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
    --query "Listeners[0].ListenerArn" \
    --output text \
    --region $AWS_REGION)

# Create backend task definition
echo "Creating task definition for backend..."
cat > backend-task-def.json << EOF
{
    "family": "${STACK_NAME}-backend",
    "networkMode": "awsvpc",
    "executionRoleArn": "${TASK_EXECUTION_ROLE_ARN}",
    "taskRoleArn": "${TASK_ROLE_ARN}",
    "containerDefinitions": [
        {
            "name": "backend",
            "image": "${BACKEND_IMAGE_URI}",
            "essential": true,
            "portMappings": [
                {
                    "containerPort": 3001,
                    "hostPort": 3001,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "PORT", "value": "3001"},
                {"name": "DB_HOST", "value": "${RDS_ENDPOINT}"},
                {"name": "DB_PORT", "value": "5432"},
                {"name": "DB_NAME", "value": "${RDS_DB_NAME}"},
                {"name": "DB_USER", "value": "${RDS_USERNAME}"},
                {"name": "DB_PASSWORD", "value": "${RDS_PASSWORD}"},
                {"name": "OPENAI_API_KEY", "value": "${OPENAI_API_KEY}"},
                {"name": "QDRANT_URL", "value": "http://localhost:6333"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/${STACK_NAME}/ecs/backend",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "backend",
                    "awslogs-create-group": "true"
                }
            }
        },
        {
            "name": "qdrant",
            "image": "qdrant/qdrant:latest",
            "essential": true,
            "portMappings": [
                {
                    "containerPort": 6333,
                    "hostPort": 6333,
                    "protocol": "tcp"
                },
                {
                    "containerPort": 6334,
                    "hostPort": 6334,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {"name": "QDRANT_ALLOW_CORS", "value": "true"}
            ],
            "mountPoints": [
                {
                    "sourceVolume": "qdrant-data",
                    "containerPath": "/qdrant/storage",
                    "readOnly": false
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/${STACK_NAME}/ecs/qdrant",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "qdrant",
                    "awslogs-create-group": "true"
                }
            }
        }
    ],
    "volumes": [
        {
            "name": "qdrant-data",
            "efsVolumeConfiguration": {
                "fileSystemId": "${EFS_ID}",
                "rootDirectory": "/",
                "transitEncryption": "ENABLED",
                "authorizationConfig": {
                    "accessPointId": "${EFS_ACCESS_POINT_ID}"
                }
            }
        }
    ],
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048"
}
EOF

BACKEND_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://backend-task-def.json \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region $AWS_REGION)

# Create ECS service for backend
echo "Creating ECS service for backend..."
BACKEND_SERVICE_ARN=$(aws ecs create-service \
    --cluster $ECS_CLUSTER_NAME \
    --service-name ${STACK_NAME}-backend \
    --task-definition $BACKEND_TASK_DEF_ARN \
    --desired-count 1 \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1_ID,$SUBNET2_ID],securityGroups=[$SG_ECS_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=3001" \
    --query "service.serviceArn" \
    --output text \
    --region $AWS_REGION)

# Get the ALB DNS name
ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query "LoadBalancers[0].DNSName" \
    --output text \
    --region $AWS_REGION)

# Deploy frontend to S3
echo "Building frontend for production..."
cd ../dashboard
npm install
VITE_API_URL=http://$ALB_DNS_NAME npm run build

echo "Deploying frontend to S3..."
aws s3 sync dist/ s3://$S3_BUCKET_NAME/ --region $AWS_REGION

# Create CloudFront distribution for frontend
echo "Creating CloudFront distribution for frontend..."
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront create-distribution \
    --origin-domain-name $S3_BUCKET_NAME.s3.amazonaws.com \
    --default-root-object index.html \
    --query "Distribution.Id" \
    --output text \
    --region $AWS_REGION)

# Wait for CloudFront distribution to deploy
echo "CloudFront distribution is being created. This may take 15-20 minutes to complete."

# Get CloudFront domain name
CLOUDFRONT_DOMAIN_NAME=$(aws cloudfront describe-distribution \
    --id $CLOUDFRONT_DISTRIBUTION_ID \
    --query "Distribution.DomainName" \
    --output text \
    --region $AWS_REGION)

# Return to original directory
cd ../aws-deployment

# Save deployment information
cat >> aws-config.env << EOF
ALB_ARN=$ALB_ARN
ALB_DNS_NAME=$ALB_DNS_NAME
BACKEND_SERVICE_ARN=$BACKEND_SERVICE_ARN
CLOUDFRONT_DISTRIBUTION_ID=$CLOUDFRONT_DISTRIBUTION_ID
CLOUDFRONT_DOMAIN_NAME=$CLOUDFRONT_DOMAIN_NAME
EOF

echo "=== Deployment complete! ==="
echo "Backend API: http://$ALB_DNS_NAME"
echo "Frontend: https://$CLOUDFRONT_DOMAIN_NAME"
echo ""
echo "Note: It may take a few minutes for the services to fully initialize."
echo "You can check the status of your services in the AWS Console." 