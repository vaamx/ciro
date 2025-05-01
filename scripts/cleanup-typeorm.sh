#!/bin/bash

# Script to safely remove TypeORM entity files that are no longer needed
# Run this script after all TypeORM imports have been updated to use Prisma

ENTITIES_DIR="./server/src/core/database/entities"
BACKUP_DIR="./scripts/typeorm-backup"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
echo "Created backup directory at $BACKUP_DIR"

# Verify that there are no imports of entity files
echo "Checking for any remaining imports of entity files..."
IMPORTS=$(grep -r "from ['\"]@core/database/entities" --include="*.ts" ./server/src | grep -v "/node_modules/" | grep -v "MIGRATION_GUIDE")

if [ -n "$IMPORTS" ]; then
    echo "ERROR: Found imports of entity files. Please migrate these first:"
    echo "$IMPORTS"
    exit 1
fi

# Check for TypeORM decorators that are still being used
echo "Checking for any remaining TypeORM decorators..."
DECORATORS=$(grep -r "@Entity\|@Column\|@PrimaryColumn\|@PrimaryGeneratedColumn\|@CreateDateColumn\|@UpdateDateColumn\|@ManyToOne\|@OneToMany\|@JoinColumn" --include="*.ts" ./server/src | grep -v "/node_modules/" | grep -v "$ENTITIES_DIR")

if [ -n "$DECORATORS" ]; then
    echo "WARNING: Found TypeORM decorators outside of entity files. These might need to be updated:"
    echo "$DECORATORS"
    echo "Continuing with backup and removal..."
fi

# Copy entity files to backup directory
echo "Backing up entity files to $BACKUP_DIR..."
cp "$ENTITIES_DIR"/*.ts "$BACKUP_DIR/"

# Count and list entities to be removed
ENTITY_COUNT=$(ls -1 "$ENTITIES_DIR"/*.entity.ts 2>/dev/null | wc -l)
echo "Found $ENTITY_COUNT entity files to remove:"
ls -1 "$ENTITIES_DIR"/*.entity.ts 2>/dev/null

# Remove entity files
echo "Removing entity files..."
rm -f "$ENTITIES_DIR"/*.entity.ts

# Remove other TypeORM-specific files in the entities directory 
OTHER_COUNT=$(ls -1 "$ENTITIES_DIR"/*enum.ts 2>/dev/null | wc -l)
echo "Found $OTHER_COUNT additional TypeORM-related files:"
ls -1 "$ENTITIES_DIR"/*enum.ts 2>/dev/null

echo "Do you want to remove these files as well? (y/n)"
read -p "> " REMOVE_OTHERS

if [ "$REMOVE_OTHERS" = "y" ]; then
    rm -f "$ENTITIES_DIR"/*enum.ts
    echo "Removed additional TypeORM-related files"
else
    echo "Skipped removal of additional files"
fi

echo "Cleanup complete. TypeORM entity files have been moved to $BACKUP_DIR"
echo "To complete the migration, update package.json to remove TypeORM dependencies:"
echo "  - @nestjs/typeorm"
echo "  - typeorm" 