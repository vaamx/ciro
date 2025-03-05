#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting dashboard in development mode...${NC}"

# Navigate to dashboard directory
cd dashboard || { echo "Dashboard directory not found!"; exit 1; }

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Start the dashboard in development mode
echo -e "${YELLOW}Running npm run dev...${NC}"
npm run dev

echo -e "${GREEN}Dashboard started!${NC}" 