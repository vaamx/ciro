# Prisma Integration Guide

This guide explains how to properly integrate Prisma into the Ciro application codebase, replacing Knex queries with Prisma ORM.

## Table of Contents
- [Using the Prisma Client](#using-the-prisma-client)
- [Repository Pattern with Prisma](#repository-pattern-with-prisma)
- [Migrating from Knex to Prisma](#migrating-from-knex-to-prisma)
- [Common Patterns and Best Practices](#common-patterns-and-best-practices)
- [Debugging and Performance Tips](#debugging-and-performance-tips)

## Using the Prisma Client

The Prisma client is set up as a singleton in `server/src/infrastructure/database/prisma/client.ts`. Always import it from this file:

```typescript
import { prisma } from '../infrastructure/database/prisma/client';
```

### Basic CRUD Operations

```typescript
// Create
const newUser = await prisma.users.create({
  data: {
    email: 'user@example.com',
    password_hash: '...',
    role: 'user',
    // Other fields...
  }
});

// Read
const user = await prisma.users.findUnique({
  where: { id: 'user-uuid' }
});

// Update
const updatedUser = await prisma.users.update({
  where: { id: 'user-uuid' },
  data: { 
    first_name: 'New Name',
    // Other fields to update...
  }
});

// Delete
await prisma.users.delete({
  where: { id: 'user-uuid' }
});
```

### Relations and Nested Queries

Prisma makes it easy to work with relations:

```typescript
// Get user with their organization
const userWithOrg = await prisma.users.findUnique({
  where: { id: 'user-uuid' },
  include: {
    organizations: true
  }
});

// Get organizations with their members
const orgsWithUsers = await prisma.organizations.findMany({
  include: {
    organization_members: {
      include: {
        users: true
      }
    }
  }
});
```

### Transactions

Use transactions to ensure database operations are atomic:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Create a new team
  const team = await tx.teams.create({
    data: {
      name: 'New Team',
      description: 'Team description',
      organization_id: 1
    }
  });
  
  // Add a member to the team
  const teamMember = await tx.team_members.create({
    data: {
      team_id: team.id,
      user_id: 'user-uuid',
      role: 'member'
    }
  });
  
  return { team, teamMember };
});
```

## Repository Pattern with Prisma

The repository pattern is used to abstract database access from the business logic. See `UserRepositoryPrisma` as an example:

```typescript
export class SomeRepositoryPrisma implements ISomeRepository {
  async findById(id: string): Promise<SomeEntity | null> {
    const entity = await prisma.some_table.findUnique({
      where: { id }
    });
    
    return entity ? this.mapToDomainEntity(entity) : null;
  }
  
  // More repository methods...
  
  // Helper methods to map between Prisma and domain models
  private mapToDomainEntity(prismaEntity: any): SomeEntity {
    return new SomeEntity({
      // Map Prisma fields to domain entity
    });
  }
  
  private mapToPrismaEntity(entity: SomeEntity): any {
    return {
      // Map domain entity to Prisma fields
    };
  }
}
```

## Migrating from Knex to Prisma

### Step 1: Identify Knex Query

```typescript
// Knex example
const users = await knex('users')
  .select('*')
  .where('organization_id', orgId)
  .orderBy('created_at', 'desc');
```

### Step 2: Convert to Prisma

```typescript
// Prisma equivalent
const users = await prisma.users.findMany({
  where: {
    organization_id: orgId
  },
  orderBy: {
    created_at: 'desc'
  }
});
```

### Complex Query Migration Examples

#### Raw SQL to Prisma

```typescript
// Knex raw query
const result = await knex.raw(`
  SELECT * FROM users 
  WHERE organization_id = ? 
  AND created_at > ?
`, [orgId, startDate]);

// Prisma equivalent
const users = await prisma.users.findMany({
  where: {
    organization_id: orgId,
    created_at: {
      gt: startDate
    }
  }
});

// For truly complex queries, you can still use raw SQL with Prisma
const result = await prisma.$queryRaw`
  SELECT * FROM users 
  WHERE organization_id = ${orgId} 
  AND created_at > ${startDate}
`;
```

#### Joins to Relations

```typescript
// Knex with joins
const teamMembers = await knex('team_members')
  .join('users', 'users.id', 'team_members.user_id')
  .select('users.*', 'team_members.role')
  .where('team_members.team_id', teamId);

// Prisma with relations
const team = await prisma.teams.findUnique({
  where: { id: teamId },
  include: {
    team_members: {
      include: {
        users: true
      }
    }
  }
});

// The result structure will be different, but contains the same data:
const teamMembers = team.team_members.map(member => ({
  ...member.users,
  role: member.role
}));
```

## Common Patterns and Best Practices

### Pagination

```typescript
const page = 1;
const limit = 10;
const skip = (page - 1) * limit;

const [items, total] = await prisma.$transaction([
  prisma.some_table.findMany({
    skip,
    take: limit,
    // where, orderBy, etc.
  }),
  prisma.some_table.count({
    // same where conditions
  })
]);

return {
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
};
```

### Connection Management

The connection is managed automatically by the singleton. For long-running processes or scripts, explicitly disconnect:

```typescript
try {
  // Perform database operations
} finally {
  await prisma.$disconnect();
}
```

### Filtering and Searching

```typescript
// Build a dynamic where clause
const where: any = {};

if (filters.name) {
  where.name = {
    contains: filters.name,
    mode: 'insensitive' // case-insensitive search
  };
}

if (filters.status) {
  where.status = filters.status;
}

if (filters.dateRange) {
  where.created_at = {
    gte: filters.dateRange.from,
    lte: filters.dateRange.to
  };
}

const results = await prisma.some_table.findMany({ where });
```

## Debugging and Performance Tips

### Logging Queries

The client is configured to log in development mode. To temporarily enable logs in other environments:

```typescript
const result = await prisma.$transaction(
  async (tx) => {
    tx.$logQuery = true;
    // Your queries will be logged
    return tx.some_table.findMany();
  },
  {
    maxWait: 5000, // 5s maximum waiting time
    timeout: 10000 // 10s maximum transaction time
  }
);
```

### Performance Optimization

1. **Use Select**: Only select the fields you need to reduce data transfer

```typescript
const users = await prisma.users.findMany({
  select: {
    id: true,
    email: true,
    first_name: true,
    last_name: true
  }
});
```

2. **Avoid N+1 Queries**: Always use `include` for related data

3. **Batching**: Use `$transaction` for multiple related operations

4. **Indexes**: Ensure your database has proper indexes for query patterns

For more tips and best practices, refer to the [Prisma documentation](https://www.prisma.io/docs/concepts/components/prisma-client/crud). 