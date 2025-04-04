# CIRO CI/CD Deployment Guide

This guide explains how to use the streamlined CIRO deployment process for reliable deployments to AWS infrastructure.

## Overview

The CIRO deployment system consists of three main scripts:

1. **deploy-frontend.sh**: Builds and deploys the frontend to S3/CloudFront
2. **deploy-backend.sh**: Builds, pushes, and deploys the backend to ECS
3. **deploy-full.sh**: Orchestrates the deployment of both frontend and backend
4. **verify-deployment.sh**: Verifies the deployment is working correctly

## Prerequisites

- AWS CLI configured with appropriate credentials
- Docker installed and running (for backend deployments)
- Node.js and npm installed (for frontend builds)

## Deployment Options

### Basic Usage

For a complete deployment of both frontend and backend:

```bash
./deploy-full.sh
```

### Frontend-Only Deployment

To deploy only the frontend:

```bash
./deploy-full.sh --frontend-only
```

Alternatively, you can use the frontend-specific script directly:

```bash
./deploy-frontend.sh
```

### Backend-Only Deployment

To deploy only the backend:

```bash
./deploy-full.sh --backend-only
```

Alternatively, you can use the backend-specific script directly:

```bash
./deploy-backend.sh
```

### Advanced Options

Each script has its own set of options for fine-grained control:

#### Frontend Deployment Options

```bash
./deploy-frontend.sh --help
```

Available options:
- `--skip-build`: Skip the build step (use if you've already built locally)
- `--skip-invalidation`: Skip CloudFront cache invalidation

#### Backend Deployment Options

```bash
./deploy-backend.sh --help
```

Available options:
- `--skip-build`: Skip Docker build step
- `--skip-push`: Skip Docker push to ECR step
- `--skip-deploy`: Skip ECS service update step

## Verification

After deployment, you can verify that everything is working correctly:

```bash
./verify-deployment.sh
```

Verification options:
- `--frontend`: Verify only the frontend
- `--backend`: Verify only the backend
- `--auth`: Perform authentication verification tests
- `--all`: Verify both frontend and backend (default)

## Configuration

The deployment scripts look for `aws-config.env` to load AWS configuration. If this file doesn't exist, they'll use hardcoded fallback values.

To create or update this file, run the `setup-aws-resources.sh` script or manually create it with the following structure:

```bash
AWS_REGION="us-east-1"
STACK_NAME="ciro-stack"
ECS_CLUSTER_NAME="ciro-cluster"
ECR_REPO_BACKEND="ciro-backend"
ECR_REPO_FRONTEND="ciro-frontend"
S3_BUCKET_NAME="ciro-stack-frontend-1742157621"
CLOUDFRONT_DISTRIBUTION_ID="E1G2DAXIDHKMCQ"
BACKEND_IMAGE_URI="794038226747.dkr.ecr.us-east-1.amazonaws.com/ciro-backend:latest"
```

## Deployment Pipeline

Here's how the deployment process works:

### Frontend Deployment

1. Build the React/Vite frontend application
2. Sync the built files to the S3 bucket
3. Invalidate the CloudFront cache

### Backend Deployment

1. Build the Docker image from the backend code
2. Tag and push the image to Amazon ECR
3. Create a new task definition based on the current one
4. Update the ECS service with the new task definition
5. Wait for the deployment to complete

## Troubleshooting

If you encounter issues during deployment:

### Frontend Issues

- Check S3 bucket permissions
- Verify CloudFront distribution is configured correctly
- Ensure AWS credentials have appropriate permissions

### Backend Issues

- Check ECS service logs in CloudWatch
- Verify ECR repository exists and is accessible
- Ensure Docker is running and functioning correctly
- Check task definition for errors or misconfiguration

## Customization

These scripts are designed to be minimal but powerful. You can customize them for your specific needs:

1. Edit the hardcoded fallback values if your AWS infrastructure differs
2. Add additional steps to the deployment process as needed
3. Extend the verification script to test additional functionality

## File Structure

```
aws-deployment/
├── deploy-frontend.sh      # Frontend deployment script
├── deploy-backend.sh       # Backend deployment script
├── deploy-full.sh          # Combined deployment script
├── verify-deployment.sh    # Deployment verification
├── aws-config.env          # AWS configuration (if available)
└── CICD.md                 # This guide
```

## Best Practices

- Always run verification after deployment
- Use the `--frontend-only` or `--backend-only` flags when only making changes to one part of the system
- Keep the `aws-config.env` file up to date with your actual AWS infrastructure
- Add appropriate error handling and monitoring for production deployments

## Support

If you encounter issues or have questions about the deployment process, please open an issue in the repository or contact the development team.

---

**Note**: This deployment system is designed to be straightforward and reliable. If you need more advanced features (automatic rollbacks, blue/green deployments, etc.), consider integrating with a CI/CD service like GitHub Actions, Jenkins, or AWS CodePipeline. 