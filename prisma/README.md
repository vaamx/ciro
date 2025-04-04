# Prisma Schema for Compatibility

This directory contains a copy of the Prisma schema for compatibility with standard Prisma CLI commands. The primary schema file is located at:

```
server/src/infrastructure/database/prisma/schema/schema.prisma
```

## Important Notes

1. This copy exists to allow Prisma commands to work without having to specify the `--schema` parameter.
2. When making changes to the schema, remember to update both copies to keep them in sync.
3. The scripts in package.json have been updated to use this location for simplicity.

## Usage

You can run Prisma commands from any of these locations:

1. From the project root:
   ```
   npx prisma studio
   ```

2. From the schema directory:
   ```
   cd server/src/infrastructure/database/prisma/schema
   npx prisma studio
   ```

3. Using npm scripts:
   ```
   npm run prisma:studio
   ```
