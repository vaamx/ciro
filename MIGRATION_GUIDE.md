# TypeORM to Prisma Migration Guide

## Migration Status

### Completed ✅
- Set up PrismaService and PrismaModule for dependency injection
- Define Prisma schema with all necessary models
- Create prisma-types.ts with type aliases and extended interfaces
- Migrate document-processing service to use Prisma
- Update core auth mechanisms to use Prisma
- Remove TypeORM from app.module.ts
- Document processing module is fully migrated to Prisma

### In Progress 🔄
- Updating imports from TypeORM entities to Prisma models
- Replacing TypeORM repositories with PrismaService
- Transforming database queries from TypeORM to Prisma syntax

### Todo 📝
- Remove legacy TypeORM files after confirming they are no longer used
- Update remaining modules to use PrismaService
- Test all functionality with Prisma integration
- Cleanup TypeORM dependencies and configurations

## Migration Steps

1. **Use Prisma Types**
   - Import Prisma generated types directly from `@prisma/client`
   - Use type aliases from `@core/database/prisma-types.ts` for better developer experience
   - Example: Replace `import { User } from '@core/database/entities/user.entity'` with `import { User } from '@core/database/prisma-types'`

2. **Update Controller Imports**
   - Controllers should import from prisma-types.ts, not entity files
   - Look for decorators like `@GetUser()` to ensure they're using the correct type

3. **Transform Database Entities**
   - Migrate entity imports to Prisma model types
   - Replace TypeORM decorators with Prisma schema definitions

4. **Update Services**
   - Inject `PrismaService` instead of repositories:
     ```typescript
     // OLD:
     constructor(
       @InjectRepository(User)
       private readonly userRepository: Repository<User>,
     ) {}

     // NEW:
     constructor(
       private readonly prisma: PrismaService,
     ) {}
     ```

   - Update query methods:
     ```typescript  
     // OLD:
     const user = await this.userRepository.findOne({ where: { id } });

     // NEW:
     const user = await this.prisma.users.findUnique({ where: { id } });
     ```

5. **Handle Prisma Relations**
   - Use `include` to fetch related records instead of TypeORM relations:
     ```typescript
     // OLD:
     const user = await this.userRepository.findOne({ where: { id }, relations: ['organizations'] });

     // NEW:
     const user = await this.prisma.users.findUnique({ 
       where: { id }, 
       include: { organizations: true } 
     });
     ```

6. **Update Decorators and Guards**
   - Ensure auth decorators use Prisma types
   - Update guards to work with Prisma models

7. **Cleanup TypeORM Dependencies**
   - Remove TypeORM configurations from app.module.ts
   - Delete entity files once migration is complete
   - Remove TypeORM packages from package.json

## Testing

Make sure to test:
1. Data retrieval works correctly
2. Relations are properly fetched
3. Authorization and authentication still function
4. CRUD operations perform as expected

## Common Issues

### Type Errors
- Prisma models might have different field names or types
- Use the prisma-types.ts interfaces to create type-safe translations

### Missing Fields
- Ensure all fields from TypeORM entities exist in Prisma models
- Check for naming differences (snake_case in Prisma vs camelCase in TypeORM)

### Authentication Issues
- Verify that auth guards and decorators are updated with Prisma types
- Test token generation and validation

## Next Steps

1. Check remaining entity files in `server/src/core/database/entities/` and confirm they're no longer imported anywhere
2. Delete the entity files if they're no longer referenced
3. Check the automation module as it contains comments referencing TypeORM that need cleanup
4. Run tests for all API endpoints to ensure they function with Prisma
5. Update the package.json to remove TypeORM dependencies

## Files Still Needing Migration

Based on the current analysis, the following files may still need migration or cleanup:

### Entity Files to Remove
- `server/src/core/database/entities/category.entity.ts`
- `server/src/core/database/entities/user.entity.ts`
- `server/src/core/database/entities/data-source.entity.ts`
- `server/src/core/database/entities/document-chunk.entity.ts`
- `server/src/core/database/entities/team.entity.ts`
- `server/src/core/database/entities/processing-job.entity.ts`
- `server/src/core/database/entities/organization-member.entity.ts`
- `server/src/core/database/entities/organization.entity.ts`

### Modules to Check
- `server/src/modules/automation/automation.module.ts` - Contains comments about TypeOrmModule
- `server/src/modules/automation/automation.service.ts` - Contains TODO comments about TypeORM

Once these files are addressed, the migration from TypeORM to Prisma will be complete. 