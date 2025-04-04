# CIRO Deployment Guide

This guide explains the deployment process for the CIRO application, including the improvements made to handle database migrations and task provisioning.

## Overview

The CIRO deployment process has been improved to:

1. **Integrate database migrations into the backend deployment process**
2. **Fix task deprovisioning issues during backend deployments**
3. **Create a unified migration system that handles both Prisma and TypeScript migrations**

## Deployment Scripts

### Main Deployment Scripts

- **`deploy-full.sh`**: Deploys both frontend and backend, including database migrations
- **`deploy-frontend.sh`**: Deploys only the frontend
- **`deploy-backend.sh`**: Deploys the backend and runs database migrations

### Migration Scripts

- **`deploy-migrations-ssm.sh`**: Runs database migrations through SSM Run Command (standalone)
- **`deploy-prisma-migrations.sh`**: Runs both Prisma and TypeScript migrations directly (standalone)

## Command-Line Options

### deploy-full.sh

```bash
./deploy-full.sh [options]
```

Options:
- `--frontend-only`: Deploy only the frontend
- `--backend-only`: Deploy only the backend 
- `--skip-migrations`: Skip database migrations when deploying backend
- `--skip-verify`: Skip the verification step
- `--help`: Display help message

### deploy-backend.sh

```bash
./deploy-backend.sh [options]
```

Options:
- `--skip-build`: Skip Docker build step
- `--skip-push`: Skip Docker push to ECR step
- `--skip-deploy`: Skip ECS service update step
- `--skip-migrations`: Skip database migrations step
- `--help`: Display help message

## Typical Deployment Workflow

1. **Full Deployment**:
   ```bash
   cd aws-deployment
   ./deploy-full.sh
   ```
   This will:
   - Build and deploy the backend
   - Run database migrations
   - Deploy the frontend
   - Verify the deployment

2. **Backend-Only Deployment**:
   ```bash
   cd aws-deployment
   ./deploy-full.sh --backend-only
   ```
   This will:
   - Build and deploy the backend
   - Run database migrations
   - Verify the backend deployment

3. **Backend Without Migrations**:
   ```bash
   cd aws-deployment
   ./deploy-full.sh --backend-only --skip-migrations
   ```
   This will:
   - Build and deploy the backend
   - Skip database migrations
   - Verify the backend deployment

## Task Provisioning Improvements

The deployment process now includes smart task provisioning to prevent task termination issues:

1. **Task Count Detection**: The script detects how many tasks are currently running
2. **Deployment Configuration**: Different deployment configurations are used based on the number of tasks:
   - For single tasks: Uses `maximumPercent=200,minimumHealthyPercent=100` to ensure the new task starts before the old one is terminated
   - For multiple tasks: Uses `maximumPercent=150,minimumHealthyPercent=100` for a rolling deployment

This prevents the issue where new tasks were being deprovisioned during deployment.

## Database Migration System

The unified migration system:

1. **Runs Prisma Migrations**: Applies schema changes tracked by Prisma
2. **Runs TypeScript Migrations**: Applies custom migrations for complex data transformations

### Migration Files

TypeScript migrations are stored in the `server/migrations` directory and follow this format:

```typescript
// YYYYMMDD_migration_name.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    // Migration logic here
  } catch (error: any) {
    console.error('Error in migration:', error.message);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    // Rollback logic here
  } catch (error: any) {
    console.error('Error in down migration:', error.message);
    throw error;
  }
}
```

Prisma migrations are managed through the standard Prisma migration system and are stored in the `server/prisma/migrations` directory.

## Troubleshooting

### Deployment Fails

If the deployment fails, check:

1. **AWS Console**: Check the ECS service and tasks for errors
2. **CloudWatch Logs**: Check the logs for the ECS tasks
3. **Deployment Output**: Check the deployment output for specific errors

### Migration Fails

If migrations fail:

1. Check the migration output in `/tmp/migration-output.log`
2. Run migrations manually:
   ```bash
   cd aws-deployment
   ./deploy-migrations-ssm.sh
   ```

## Further Documentation

For more details, see:
- `server/migrations/utils/MIGRATION_SYSTEM.md`: Details on the migration system
- `server/migrations/utils/MIGRATION_CONVERSION.md`: Details on the JS to TS migration conversion 