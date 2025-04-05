#!/bin/bash

# Script to convert singleton pattern to dependency injection
# This script works with Express applications (not requiring NestJS)

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

# Step 3: Register services in Express app (adapted for Express instead of NestJS)
echo -e "\n🔧 Step 3: Setting up dependency injection for Express app..."
npx ts-node register-services-express.ts

echo -e "\n✅ Conversion process complete! Please review the changes and resolve any issues."
echo "You can look at .bak files to see the original versions of modified files."
echo -e "\nTo clean up backup files after verification, run: find src -name '*.bak' -delete"

echo -e "\n📝 Note: Although we're using the @Injectable() decorator from NestJS,"
echo "this implementation uses a lightweight ServiceRegistry that doesn't require a full NestJS setup." 