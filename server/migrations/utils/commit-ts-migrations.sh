#!/bin/bash
# Script to clean up and commit JS to TS migration changes

# Set error handling
set -e

# Get the utils directory and navigate to the migrations parent directory
UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$UTILS_DIR/.." && pwd)"
cd "$MIGRATIONS_DIR"

echo "=== JS to TS Migration Conversion Commit ==="
echo "Working directory: $MIGRATIONS_DIR"

# Verify that all JS files have been converted
echo "Validating all conversions..."
JS_FILES=$(find . -maxdepth 1 -name "*.js" | wc -l)
TS_FILES=$(find . -maxdepth 1 -name "*.ts" | wc -l)

echo "Found $JS_FILES JavaScript migration files"
echo "Found $TS_FILES TypeScript migration files"

# Run validation to ensure TypeScript files are valid
echo "Running TypeScript validation..."
cd "$UTILS_DIR"
npx ts-node validate-migrations.ts

if [[ $? -ne 0 ]]; then
  echo "❌ Validation failed. Please fix the issues and try again."
  exit 1
fi

echo "✅ All TypeScript migrations are valid!"

# Return to migrations directory
cd "$MIGRATIONS_DIR"

# Ask user about keeping or removing JS files
read -p "Would you like to remove the original JavaScript migration files? (y/n): " REMOVE_JS

if [[ "$REMOVE_JS" == "y" || "$REMOVE_JS" == "Y" ]]; then
  echo "Removing JavaScript migration files..."
  find . -maxdepth 1 -name "*.js" -exec rm {} \;
  echo "JavaScript files removed."
else
  echo "Keeping JavaScript migration files alongside TypeScript files."
fi

# Navigate to server root for git operations
cd "$(cd "$MIGRATIONS_DIR/.." && pwd)"

# Prepare for git commit
echo "Preparing for git commit..."

# Check if we're in a git repository
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  # Stage the files
  git add ./migrations/*.ts
  
  if [[ "$REMOVE_JS" == "y" || "$REMOVE_JS" == "Y" ]]; then
    git add ./migrations/
  fi
  
  # Also stage the utility files
  git add ./migrations/utils/
  
  # List files to be committed
  echo "Files staged for commit:"
  git diff --name-only --cached
  
  # Prompt for commit
  read -p "Ready to commit? (y/n): " COMMIT
  
  if [[ "$COMMIT" == "y" || "$COMMIT" == "Y" ]]; then
    git commit -m "Convert JavaScript migrations to TypeScript and add migration utilities"
    echo "✅ Changes committed!"
  else
    echo "Commit skipped. Changes are still staged."
  fi
else
  echo "Not inside a git repository. Skipping git operations."
  echo "✅ Conversion complete, but changes not committed."
fi

echo "=== Migration Conversion Process Complete ===" 