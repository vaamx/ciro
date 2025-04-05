#!/bin/bash

# Script to convert singleton pattern to dependency injection in NestJS
# This script will run all conversion scripts in sequence

set -e  # Exit on any error

echo "🚀 Starting conversion from singletons to dependency injection..."

# Install required dependencies
echo "📦 Installing required dependencies..."
npm install typescript glob @types/glob --save-dev

# Step 1: Transform singleton services to injectable services
echo -e "\n🔧 Step 1: Transforming singleton services to injectable services..."
npx ts-node transform-singletons.ts

# Step 2: Update references to getInstance() throughout the codebase
echo -e "\n🔧 Step 2: Updating references to getInstance() throughout the codebase..."
npx ts-node update-references.ts

# Step 3: Register services in main app module
echo -e "\n🔧 Step 3: Registering services in main app module..."
npx ts-node register-services.ts

echo -e "\n✅ Conversion process complete! Please review the changes and resolve any issues."
echo "You can look at .bak files to see the original versions of modified files."
echo -e "\nTo clean up backup files after verification, run: find src -name '*.bak' -delete" 