# AWS Deployment Guide for Ciro Application

This guide explains how to deploy the Ciro application to AWS using the provided scripts. The deployment includes:

- Frontend dashboard (React/Vite) on Amazon S3 + CloudFront
- Backend server (Node.js/Express) on Amazon ECS (Fargate)
- Qdrant vector database as a sidecar container in the ECS task
- PostgreSQL database on Amazon RDS

## Prerequisites

Before you begin, ensure you have:

1. **AWS CLI** installed and configured with appropriate permissions
2. **Docker** installed and running
3. **Node.js** and npm installed
4. An AWS account with permissions to create:
   - EC2 (VPC, Security Groups, etc.)
   - ECS (Clusters, Tasks, Services)
   - ECR (Repositories)
   - RDS (PostgreSQL database)
   - S3 (Buckets)
   - CloudFront (Distributions)
   - IAM (Roles, Policies)
   - EFS (File Systems)
   - Load Balancers

## Deployment Steps

### 1. Prepare the Environment

Create the aws-deployment directory if it doesn't exist:

```bash
mkdir -p aws-deployment
```

Make all scripts executable:

```bash
chmod +x aws-deployment/*.sh
```

### 2. Set Up AWS Infrastructure

Run the setup script to create the basic AWS infrastructure:

```bash
cd aws-deployment
./setup-aws-resources.sh
```

This script will create:
- VPC with subnets and security groups
- ECR repositories for Docker images
- S3 bucket for the frontend
- ECS cluster

### 3. Create RDS Database

Create the PostgreSQL RDS instance:

```bash
./create-rds.sh
```

This will create a PostgreSQL database in AWS RDS. The credentials will be saved in the `aws-config.env` file.

### 4. Deploy Prisma Migrations

Deploy your database schema using Prisma migrations:

```bash
./deploy-prisma-migrations.sh
```

This will apply all your Prisma migrations to the AWS RDS database, ensuring all tables and relationships are properly created before deploying your application.

### 5. Build and Push Docker Images

Build the Docker images for the backend and frontend, then push them to ECR:

```bash
./build-and-push.sh
```

### 6. Deploy Services

Set your OpenAI API key in the environment:

```bash
export OPENAI_API_KEY=your_openai_api_key_here
```

Deploy the services to AWS:

```bash
./deploy-services.sh
```

This script will:
- Create ECS task definitions
- Set up an Application Load Balancer (ALB)
- Deploy the backend service to ECS Fargate
- Build and deploy the frontend to S3
- Create a CloudFront distribution for the frontend

## Access Your Application

After deployment, you can access your application at:

- Frontend: The CloudFront URL (displayed after deployment)
- Backend API: The ALB URL (displayed after deployment)

## Environment Variables

Important environment variables used in deployment:

- `OPENAI_API_KEY`: Your OpenAI API key
- `DB_USER`, `DB_PASSWORD`: PostgreSQL credentials (generated during deployment)
- `QDRANT_URL`: Set to point to the Qdrant container in the same task

## Post-Deployment Tasks

After deploying your application, you should:

1. Set up HTTPS with a custom domain (if needed)
2. Configure CloudFront to redirect HTTP to HTTPS
3. Set up monitoring and alerts
4. Configure database backups (RDS has automated backups)

## Scaling Your Application

To scale your application:

- **Backend**: Update the ECS service to increase the desired count of tasks
- **Database**: Modify the RDS instance to a larger instance class
- **Qdrant**: Consider using a separate ECS service for Qdrant if you need to scale it independently

## Troubleshooting

If you encounter issues:

1. Check the ECS task logs in CloudWatch
2. Verify security group rules allow communication between services
3. Check that environment variables are correctly set in the task definition

## Cleanup

To avoid unnecessary AWS charges, remove resources when not needed:

```bash
# Delete scripts to be created later
``` 