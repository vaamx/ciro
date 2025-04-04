# Migrating from Knex to Prisma

This guide outlines the steps to migrate database operations from Knex to Prisma in the Ciro application.

## Table of Contents

- [Overview](#overview)
- [Migration Plan](#migration-plan)
- [Step-by-Step Guide](#step-by-step-guide)
- [Common Challenges](#common-challenges)
- [Testing Strategies](#testing-strategies)

## Overview

Prisma provides a type-safe and modern API for database access, making it easier to work with your database compared to raw SQL or query builders like Knex. The migration plan involves gradually replacing Knex queries with Prisma operations across the codebase.

## Migration Plan

1. **Incremental Migration**: Migrate one module at a time, starting with simpler ones
2. **Parallel Operation**: Continue to support both Knex and Prisma during the transition
3. **Testing**: Thoroughly test each module after migration
4. **Documentation**: Update documentation to reflect Prisma usage

## Step-by-Step Guide

### 1. Identify Files Using Knex

```bash
find server/src -name "*.ts" -type f -exec grep -l "knex" {} \;
```

### 2. Prioritize Files for Migration

Start with:
- Repository classes (highest priority)
- Controllers with simple database operations
- Services with database operations
- Complex queries and migrations (lowest priority)

### 3. For Each File:

a. **Create a Prisma Version**:
   - First, create a Prisma version alongside the Knex version (e.g., `UserRepository.ts` → `UserRepositoryPrisma.ts`)
   - Use the repository pattern examples in `server/src/repositories/`

b. **Update Imports**:
   - Replace Knex imports with Prisma:
   ```typescript
   // Before
   import { db } from '../infrastructure/database';
   
   // After
   import { prisma } from '../infrastructure/database/prisma/client';
   ```

c. **Convert Queries**:
   - Use the examples from the Prisma Integration Guide
   - Common conversions:

   ```typescript
   // Knex: Select all
   const users = await knex('users').select('*');
   
   // Prisma: Select all
   const users = await prisma.users.findMany();
   
   // Knex: Select with where
   const user = await knex('users').where({ id }).first();
   
   // Prisma: Select with where
   const user = await prisma.users.findUnique({ where: { id } });
   
   // Knex: Insert
   const [user] = await knex('users')
     .insert({ name, email })
     .returning(['id', 'name', 'email']);
   
   // Prisma: Insert
   const user = await prisma.users.create({
     data: { name, email },
     select: { id: true, name: true, email: true }
   });
   
   // Knex: Update
   await knex('users').where({ id }).update({ name });
   
   // Prisma: Update
   await prisma.users.update({
     where: { id },
     data: { name }
   });
   
   // Knex: Delete
   await knex('users').where({ id }).delete();
   
   // Prisma: Delete
   await prisma.users.delete({ where: { id } });
   
   // Knex: Transactions
   await knex.transaction(async (trx) => {
     await trx('users').insert(...);
     await trx('profiles').insert(...);
   });
   
   // Prisma: Transactions
   await prisma.$transaction(async (tx) => {
     await tx.users.create(...);
     await tx.profiles.create(...);
   });
   ```

d. **For Raw Queries**:
   ```typescript
   // Knex: Raw query
   const result = await knex.raw('SELECT * FROM users WHERE id = ?', [id]);
   
   // Prisma: Raw query
   const result = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;
   ```

e. **For Joins**:
   ```typescript
   // Knex: Join
   const posts = await knex('posts')
     .join('users', 'users.id', 'posts.user_id')
     .select('posts.*', 'users.name as author_name');
   
   // Prisma: Relations
   const posts = await prisma.posts.findMany({
     include: {
       users: {
         select: {
           name: true
         }
       }
     }
   });
   
   // Transform to match the original shape if needed
   const transformedPosts = posts.map(post => ({
     ...post,
     author_name: post.users.name
   }));
   ```

### 4. Test Thoroughly:

- Create unit tests for the new Prisma repository
- Compare outputs between Knex and Prisma implementations
- Test edge cases like empty results, errors, etc.

### 5. Swap implementations:

Once tested:
- Update dependency injection to use the Prisma implementation
- Remove the original Knex implementation

## Common Challenges

### 1. Schema differences

The Prisma schema may not exactly match your database structure. You have options:

- Update the Prisma schema to match the database
- Use raw queries for complex operations
- Create views in the database that match your desired schema

### 2. Complex queries

For very complex queries:
- Use `prisma.$queryRaw` as a fallback
- Consider creating database views
- Break down complex queries into simpler ones

### 3. Migration scripts

- Keep using Knex migrations for now
- Use `prisma db push` carefully for schema changes

## Testing Strategies

1. **Unit Tests**:
   - Test repositories in isolation
   - Mock Prisma client for controller/service tests

2. **Integration Tests**:
   - Use a test database
   - Seed test data before tests
   - Clean up after tests

3. **Manual Testing**:
   - Test critical flows end-to-end
   - Compare results between Knex and Prisma implementations

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Prisma Integration Guide](./PRISMA-GUIDE.md)
- Sample implementations:
  - `server/src/repositories/UserRepositoryPrisma.ts`
  - `server/src/repositories/OrganizationRepositoryPrisma.ts`
  - `server/src/examples/auth.controller.prisma.ts` 