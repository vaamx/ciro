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
    echo "WARNING: OPENAI_API_KEY environment variable is not set."
    echo "Using a placeholder value for deployment. You must set a real API key in the ECS task before using the application."
    # Using placeholder for deployment purposes
    export OPENAI_API_KEY="sk-placeholder-for-deployment-update-in-aws-console"
fi

echo "=== Deploying services to AWS ECS ==="
echo "Cluster: $ECS_CLUSTER_NAME"
echo "Backend image: $BACKEND_IMAGE_URI"
echo "RDS endpoint: $RDS_ENDPOINT"

# Create task execution role
echo "Creating task execution role..."
if aws iam get-role --role-name ${STACK_NAME}-task-execution-role --region $AWS_REGION >/dev/null 2>&1; then
    echo "Task execution role already exists, using existing role."
    TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-execution-role --query "Role.Arn" --output text --region $AWS_REGION)
else
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
    
    TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-execution-role --query "Role.Arn" --output text --region $AWS_REGION)
fi

# Create ECS task role for application permissions
echo "Creating task role..."
if aws iam get-role --role-name ${STACK_NAME}-task-role --region $AWS_REGION >/dev/null 2>&1; then
    echo "Task role already exists, using existing role."
    TASK_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-role --query "Role.Arn" --output text --region $AWS_REGION)
else
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
    
    TASK_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-role --query "Role.Arn" --output text --region $AWS_REGION)
fi

# Get role ARNs
TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-execution-role --query "Role.Arn" --output text --region $AWS_REGION)
TASK_ROLE_ARN=$(aws iam get-role --role-name ${STACK_NAME}-task-role --query "Role.Arn" --output text --region $AWS_REGION)

# Create EFS for Qdrant data persistence
echo "Setting up EFS filesystem..."
# Check if EFS with tag Name=${STACK_NAME}-qdrant-data already exists
EXISTING_EFS=$(aws efs describe-file-systems \
    --query "FileSystems[?Tags[?Key=='Name' && Value=='${STACK_NAME}-qdrant-data']].FileSystemId" \
    --output text \
    --region $AWS_REGION)

if [ -n "$EXISTING_EFS" ]; then
    echo "EFS filesystem already exists with ID: $EXISTING_EFS"
    EFS_ID=$EXISTING_EFS
else
    echo "Creating new EFS filesystem..."
    EFS_ID=$(aws efs create-file-system \
        --performance-mode generalPurpose \
        --throughput-mode bursting \
        --encrypted \
        --tags Key=Name,Value=${STACK_NAME}-qdrant-data \
        --query "FileSystemId" \
        --output text \
        --region $AWS_REGION)

    # Wait for EFS to be available using polling instead of wait command
    echo "Waiting for EFS to become available..."
    EFS_STATUS="creating"
    while [ "$EFS_STATUS" != "available" ]; do
        echo "Checking EFS status..."
        EFS_STATUS=$(aws efs describe-file-systems \
            --file-system-id $EFS_ID \
            --query "FileSystems[0].LifeCycleState" \
            --output text \
            --region $AWS_REGION)
        
        if [ "$EFS_STATUS" != "available" ]; then
            echo "EFS status: $EFS_STATUS, waiting 10 seconds..."
            sleep 10
        fi
    done
    echo "EFS is now available!"
fi

# Create mount targets in each subnet
echo "Creating EFS mount targets..."
# Check if mount targets already exist
EXISTING_MOUNT_TARGETS=$(aws efs describe-mount-targets \
    --file-system-id $EFS_ID \
    --query "MountTargets[].MountTargetId" \
    --output text \
    --region $AWS_REGION)

if [ -n "$EXISTING_MOUNT_TARGETS" ]; then
    echo "Mount targets already exist for EFS: $EFS_ID"
else
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
fi

# Create EFS access point
echo "Creating EFS access point..."
# Check if access point already exists
EXISTING_ACCESS_POINT=$(aws efs describe-access-points \
    --file-system-id $EFS_ID \
    --query "AccessPoints[?RootDirectory.Path=='/qdrant_data'].AccessPointId" \
    --output text \
    --region $AWS_REGION)

if [ -n "$EXISTING_ACCESS_POINT" ]; then
    echo "EFS access point already exists with ID: $EXISTING_ACCESS_POINT"
    EFS_ACCESS_POINT_ID=$EXISTING_ACCESS_POINT
else
    EFS_ACCESS_POINT_ID=$(aws efs create-access-point \
        --file-system-id $EFS_ID \
        --posix-user "Uid=1000,Gid=1000" \
        --root-directory "Path=/qdrant_data,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=755}" \
        --query "AccessPointId" \
        --output text \
        --region $AWS_REGION)
fi

# Create ALB
echo "Setting up Application Load Balancer..."
# Check if ALB already exists
EXISTING_ALB=$(aws elbv2 describe-load-balancers \
    --names ${STACK_NAME}-alb \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_ALB" ] && [ "$EXISTING_ALB" != "None" ]; then
    echo "ALB already exists with ARN: $EXISTING_ALB"
    ALB_ARN=$EXISTING_ALB
else
    echo "Creating new ALB..."
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
fi

# Create target group for backend
echo "Setting up target group for backend..."
# Check if target group already exists
EXISTING_TG=$(aws elbv2 describe-target-groups \
    --names ${STACK_NAME}-backend-tg \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_TG" ] && [ "$EXISTING_TG" != "None" ]; then
    echo "Target group already exists with ARN: $EXISTING_TG"
    BACKEND_TG_ARN=$EXISTING_TG
else
    echo "Creating new target group..."
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
fi

# Create listener for HTTP
echo "Setting up ALB listener..."
# Check if listener already exists
EXISTING_LISTENER=$(aws elbv2 describe-listeners \
    --load-balancer-arn $ALB_ARN \
    --query "Listeners[?Port==\`80\`].ListenerArn" \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_LISTENER" ] && [ "$EXISTING_LISTENER" != "None" ]; then
    echo "Listener already exists with ARN: $EXISTING_LISTENER"
    LISTENER_ARN=$EXISTING_LISTENER
else
    echo "Creating new listener..."
    LISTENER_ARN=$(aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
        --query "Listeners[0].ListenerArn" \
        --output text \
        --region $AWS_REGION)
fi

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
                    {"name": "DB_SCHEMA", "value": "public"},
                    {"name": "OPENAI_API_KEY", "value": "${OPENAI_API_KEY}"},
                    {"name": "OPENAI_API_BASE", "value": "${OPENAI_API_BASE:-https://api.openai.com/v1}"},
                    {"name": "OPENAI_MODEL", "value": "${OPENAI_MODEL:-o3-mini}"},
                    {"name": "OPENAI_TEMPERATURE", "value": "${OPENAI_TEMPERATURE:-0.7}"},
                    {"name": "OPENAI_MODEL_ANALYTICAL", "value": "${OPENAI_MODEL_ANALYTICAL:-o3-mini}"},
                    {"name": "OPENAI_MODEL_OVERVIEW", "value": "${OPENAI_MODEL_OVERVIEW:-o3-mini}"},
                    {"name": "OPENAI_MODEL_ENTITY", "value": "${OPENAI_MODEL_ENTITY:-o3-mini}"},
                    {"name": "OPENAI_MODEL_SIMPLE", "value": "${OPENAI_MODEL_SIMPLE:-o3-mini}"},
                    {"name": "SENDGRID_API_KEY", "value": "${SENDGRID_API_KEY}"},
                    {"name": "SENDGRID_FROM_EMAIL", "value": "${SENDGRID_FROM_EMAIL}"},
                    {"name": "FRONTEND_URL", "value": "https://${CLOUDFRONT_DOMAIN}"},
                    {"name": "SESSION_SECRET", "value": "${SESSION_SECRET:-production-session-secret}"},
                    {"name": "JWT_SECRET", "value": "${JWT_SECRET:-production-jwt-secret}"},
                    {"name": "JWT_EXPIRES_IN", "value": "${JWT_EXPIRES_IN:-24h}"},
                    {"name": "QDRANT_URL", "value": "http://localhost:6333"},
                    {"name": "LOG_LEVEL", "value": "${LOG_LEVEL:-info}"},
                    {"name": "UPLOADS_DIR", "value": "/app/uploads"},
                    {"name": "DEBUG", "value": "false"},
                    {"name": "DEBUG_EMBEDDINGS", "value": "false"},
                    {"name": "DEBUG_QDRANT", "value": "false"},
                    {"name": "DISABLE_EMBEDDING_CACHE", "value": "true"}
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
echo "Setting up ECS service for backend..."
# Check if service already exists
EXISTING_SERVICE=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER_NAME \
    --services ${STACK_NAME}-backend \
    --query "services[0].serviceArn" \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")

if [ "$EXISTING_SERVICE" != "None" ] && [ -n "$EXISTING_SERVICE" ]; then
    echo "ECS service already exists with ARN: $EXISTING_SERVICE"
    BACKEND_SERVICE_ARN=$EXISTING_SERVICE
    
    # Update the service with new task definition
    aws ecs  update-service \
        --cluster $ECS_CLUSTER_NAME \
        --service ${STACK_NAME}-backend \
        --task-definition $BACKEND_TASK_DEF_ARN \
        --region $AWS_REGION
    
    echo "Updated existing service with new task definition"
else
    echo "Creating new ECS service..."
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
fi

# Get the ALB DNS name
ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query "LoadBalancers[0].DNSName" \
    --output text \
    --region $AWS_REGION)

# Deploy frontend to S3
echo "Building frontend for production..."
cd ../dashboard

# Install dependencies with legacy peer deps and force flag to resolve conflicts
echo "Installing dependencies with legacy-peer-deps and force flags..."
npm install --legacy-peer-deps --force

# Install vite as a dev dependency with legacy-peer-deps
echo "Installing vite globally and locally..."
npm install -g vite --legacy-peer-deps || echo "Could not install vite globally, continuing with local install"
npm install --save-dev vite@latest --legacy-peer-deps --force

# Set the API URL for the frontend build
export VITE_API_URL=http://$ALB_DNS_NAME
echo "Using API URL: $VITE_API_URL for frontend build"

# Create a fallback index.html in case all build attempts fail
mkdir -p dist
echo "Creating fallback index.html file as a backup..."
cat > dist/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ciro AI Application</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: #2c3e50;
        }
        .box {
            background-color: #f8f9fa;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
    </style>
</head>
<body>
    <h1>Ciro AI Application</h1>
    <div class="box">
        <h2>Application Information</h2>
        <p>The Ciro AI backend is deployed and available at:</p>
        <p><a href="http://$ALB_DNS_NAME">http://$ALB_DNS_NAME</a></p>
        <p>You can use this endpoint to connect directly to the API.</p>
        <p>The frontend build was not completed successfully during deployment. Please contact the development team for assistance.</p>
    </div>
</body>
</html>
EOF

# Try multiple approaches to build the frontend
echo "Attempting to build with multiple approaches..."

# First attempt: Using npx with explicit path to avoid PATH issues
echo "Attempt 1: Using npx vite build..."
NODE_OPTIONS="--no-node-snapshot --no-warnings" npx --yes vite build || {
    echo "Attempt 1 failed, trying alternate approach..."
    
    # Second attempt: Using the locally installed vite with full path
    echo "Attempt 2: Using local node_modules/.bin/vite..."
    PATH="$(pwd)/node_modules/.bin:$PATH" NODE_OPTIONS="--no-node-snapshot --no-warnings" ./node_modules/.bin/vite build || {
        echo "Attempt 2 failed, trying another approach..."
        
        # Third attempt: Try with a temporary vite.config.js that doesn't require any modules
        echo "Attempt 3: Using simplified vite config..."
        # Back up the original vite.config.js
        if [ -f vite.config.js ]; then
            mv vite.config.js vite.config.js.bak
        fi
        
        # Create a simple vite config that should work
        cat > vite.config.js << VITECONFIG
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  },
});
VITECONFIG
        
        # Try building with the simplified config
        NODE_OPTIONS="--no-node-snapshot --no-warnings" npx --yes vite build || {
            echo "Attempt 3 failed. Using fallback HTML..."
            
            # Restore original vite config if it existed
            if [ -f vite.config.js.bak ]; then
                mv vite.config.js.bak vite.config.js
            fi
            
            echo "WARNING: All frontend build attempts failed. Using fallback static HTML page."
            echo "Proceeding with deployment using fallback page."
        }
        
        # Restore original vite config if all builds failed
        if [ -f vite.config.js.bak ] && [ ! -f dist/index.html ]; then
            mv vite.config.js.bak vite.config.js
        fi
    }
}

echo "Deploying frontend to S3..."
aws s3 sync dist/ s3://$S3_BUCKET_NAME/ --region $AWS_REGION

# Create CloudFront distribution for frontend if it doesn't exist
echo "Setting up CloudFront distribution for frontend..."
EXISTING_CLOUDFRONT=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[0].DomainName=='$S3_BUCKET_NAME.s3.amazonaws.com'].Id" \
    --output text \
    --region $AWS_REGION)

if [ -n "$EXISTING_CLOUDFRONT" ] && [ "$EXISTING_CLOUDFRONT" != "None" ]; then
    echo "CloudFront distribution already exists with ID: $EXISTING_CLOUDFRONT"
    CLOUDFRONT_DISTRIBUTION_ID=$EXISTING_CLOUDFRONT
else
    echo "Creating new CloudFront distribution..."
    CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront create-distribution \
        --origin-domain-name $S3_BUCKET_NAME.s3.amazonaws.com \
        --default-root-object index.html \
        --query "Distribution.Id" \
        --output text \
        --region $AWS_REGION)

    echo "CloudFront distribution is being created. This may take 15-20 minutes to complete."
fi

# Get CloudFront domain name
CLOUDFRONT_DOMAIN_NAME=$(aws cloudfront get-distribution \
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