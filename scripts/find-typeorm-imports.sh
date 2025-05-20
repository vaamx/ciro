#!/bin/bash

# Script to find all TypeORM entity imports in the codebase

echo "Finding TypeORM entity imports..."
echo "=================================="

# Find all imports from the entities directory
echo "Files importing from @core/database/entities:"
grep -r "import .* from '@core/database/entities/" --include="*.ts" ./server/src | grep -v "/node_modules/" | sort

echo ""
echo "Files importing from relative entity paths:"
grep -r "import .* from '.*\.entity'" --include="*.ts" ./server/src | grep -v "/node_modules/" | sort

echo ""
echo "TypeORM decorator usage:"
grep -r "@Entity\|@Column\|@PrimaryGeneratedColumn\|@ManyToOne\|@OneToMany\|@JoinColumn" --include="*.ts" ./server/src | grep -v "/node_modules/" | sort

echo ""
echo "TypeORM repository usage:"
grep -r "@InjectRepository\|Repository<" --include="*.ts" ./server/src | grep -v "/node_modules/" | sort

echo ""
echo "Done! Review these files for migration to Prisma."
echo "See MIGRATION_GUIDE.md for detailed instructions." 