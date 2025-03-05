#!/bin/bash

# Script to clean up all collections and data sources, and standardize naming
# USE WITH CAUTION - this will delete all data!

echo "========================================"
echo "WARNING: This script will delete ALL collections and data sources!"
echo "This is a destructive operation that cannot be undone."
echo "========================================"
echo 
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled."
    exit 1
fi

# Change to server directory
cd server

# Check system state before cleanup
echo "========================================"
echo "Checking system state BEFORE cleanup..."
echo "========================================"
npx ts-node src/scripts/check-system-state.ts

echo "Starting cleanup process..."

# First list all collections to see the naming patterns
echo "========================================"
echo "Step 1: Analyzing collection names to identify non-standard naming patterns..."
echo "========================================"
npx ts-node src/scripts/normalize-collection-names.ts

# Clean up all collections in Qdrant
echo "========================================"
echo "Step 2: Cleaning up all collections in Qdrant..."
echo "========================================"
npx ts-node src/scripts/cleanup-all-collections.ts

# Clean up all data sources
echo "========================================"
echo "Step 3: Cleaning up all data sources in the database..."
echo "========================================"
npx ts-node src/scripts/cleanup-all-datasources.ts

# Check system state after cleanup
echo "========================================"
echo "Checking system state AFTER cleanup..."
echo "========================================"
npx ts-node src/scripts/check-system-state.ts

echo "========================================"
echo "Cleanup complete!"
echo "All systems now use standardized numeric IDs for collections."
echo "========================================" 