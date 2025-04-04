# Unified Migration System

This document describes the unified migration system that combines Prisma migrations with TypeScript migrations.

## Overview

Our project previously used a mix of migration approaches:
1. Raw SQL migrations
2. JavaScript migrations
3. TypeScript migrations
4. Prisma migrations

To standardize and improve our migration process, we've created a unified system that:
1. Converts all JavaScript migrations to TypeScript
2. Creates a Prisma migration to mark the consolidation point
3. Uses Prisma for schema migrations going forward
4. Preserves the ability to run custom TypeScript migrations for complex data transformations

## Components

The unified migration system consists of the following components:

### 1. Migration Converter

`migrations/utils/migration-converter.ts`: A script that converts JavaScript migrations to TypeScript format for better type safety and consistency.

### 2. Migration Consolidator

`migrations/utils/consolidate-migrations.ts`: A script that creates a Prisma migration marker to indicate that all previous migrations have been applied. This provides a clean starting point for Prisma migrations.

### 3. Migration Runner

`src/infrastructure/database/run-migrations.ts`: A script that runs both Prisma migrations and TypeScript migrations in the correct order, ensuring all database changes are applied consistently.

### 4. Deployment Scripts

- `aws-deployment/deploy-migrations-ssm.sh`: Updated to use our unified migration system through SSM Run Command
- `aws-deployment/deploy-prisma-migrations.sh`: Updated to run both Prisma and TypeScript migrations

## Migration Process

1. **Consolidation**: Run `consolidate-migrations.ts` to create a Prisma migration marker
2. **New Schema Changes**: Use Prisma's migration system:
   ```
   npx prisma migrate dev --name migration_name
   ```
3. **Complex Data Migrations**: Create TypeScript migrations for operations that can't be expressed in SQL:
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

## Deployment Process

### Local Development

To run migrations locally:

```bash
# Set up environment
export DATABASE_URL="***REMOVED***ql://user:password@localhost:5432/dbname"

# Run migrations
npm run migrate
```

### Production Deployment

To deploy migrations to production:

1. **Using AWS SSM**:
   ```bash
   cd aws-deployment
   ./deploy-migrations-ssm.sh
   ```

2. **Direct Deployment**:
   ```bash
   cd aws-deployment
   ./deploy-prisma-migrations.sh
   ```

## Troubleshooting

### Migration Failures

If migrations fail, check the following:

1. **Database Connection**: Ensure the `DATABASE_URL` is correct and the database is accessible
2. **Migration Order**: Verify migrations are applied in the correct order
3. **Migration Errors**: Check logs for specific error messages
4. **Manual Recovery**: Connect to the database and check the `migrations` and `_prisma_migrations` tables

### Common Issues

- **Missing JS Files in Production**: Make sure the TypeScript files are compiled to JavaScript before deployment
- **Prisma Schema Mismatch**: Ensure the Prisma schema matches the actual database schema
- **Concurrent Migrations**: Avoid running migrations concurrently to prevent conflicts

## Migration Best Practices

1. **Use Prisma for Schema Changes**: Whenever possible, use Prisma migrations for schema changes
2. **Use TypeScript Migrations for Complex Operations**: Use TypeScript migrations for data transformations that can't be expressed in SQL
3. **Test Migrations Locally**: Always test migrations in a development environment before deploying to production
4. **Back Up the Database**: Always back up the production database before running migrations
5. **Use Transaction Blocks**: Wrap complex migrations in transaction blocks to ensure atomicity

## Conclusion

This unified migration system provides a consistent and reliable way to manage database migrations across environments. By combining Prisma migrations with TypeScript migrations, we can handle both schema changes and complex data transformations in a type-safe and structured way. 