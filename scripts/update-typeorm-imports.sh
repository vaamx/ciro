#!/bin/bash

# Script to automatically replace TypeORM entity imports with Prisma types

echo "Updating TypeORM imports to Prisma types..."
echo "==========================================="

# Replace User entity imports from @core path
echo "Replacing User entity imports..."
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { User } from '@core/database/entities/user.entity'|import { User } from '@core/database/prisma-types'|g" {} \;
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { User } from '@core/database/entities/user.entity'; // Placeholder path|import { User } from '@core/database/prisma-types'|g" {} \;

# Replace relative path imports for User entity
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { User } from '../../core/database/entities/user.entity'|import { User } from '../../core/database/prisma-types'|g" {} \;
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { User } from '../../database/entities/user.entity'|import { User } from '../../database/prisma-types'|g" {} \;

# Replace DataSource entity imports
echo "Replacing DataSource entity imports..."
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { DataSource } from '@core/database/entities/data-source.entity'|import { DataSource } from '@core/database/prisma-types'|g" {} \;
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { DataSource } from '../../core/database/entities/data-source.entity'|import { DataSource } from '../../core/database/prisma-types'|g" {} \;

# Replace OrganizationRole import
echo "Replacing OrganizationRole imports..."
find ./server/src -type f -name "*.ts" -exec sed -i "s|import { OrganizationRole } from '../../core/database/entities/organization-member.entity'|import { OrganizationRole } from '../../core/database/prisma-types'|g" {} \;

echo ""
echo "Done! Now run the find-typeorm-imports.sh script again to check for any remaining imports."
echo "Remember to test the application thoroughly after these changes." 