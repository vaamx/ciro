#!/bin/bash
# ============================================================
# CIRO API Configuration Checker
# ============================================================
# This script checks that the frontend is using the correct API URLs
# ============================================================

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BOLD}${BLUE}=== CIRO API Configuration Checker ===${NC}\n"

# Check if curl is installed
if ! command -v curl &> /dev/null; then
  echo -e "${RED}Error: curl is not installed.${NC}"
  exit 1
fi

# URL of the frontend
FRONTEND_URL="https://app.ciroai.us"

echo -e "Checking API configuration in production frontend..."
echo -e "Frontend URL: ${BOLD}$FRONTEND_URL${NC}"

# Fetch the main JavaScript file and check for API configuration
MAIN_JS=$(curl -s $FRONTEND_URL | grep -o 'src="[^"]*index[^"]*\.js"' | sed 's/src="//;s/"//')
if [ -z "$MAIN_JS" ]; then
  echo -e "${RED}Error: Could not find main JavaScript file.${NC}"
  exit 1
fi

FULL_JS_URL="$FRONTEND_URL/$MAIN_JS"
echo -e "Found main JavaScript file: ${BOLD}$MAIN_JS${NC}"

echo -e "\nFetching JavaScript to check API configuration..."
JS_CONTENT=$(curl -s "$FULL_JS_URL")

if [ -z "$JS_CONTENT" ]; then
  echo -e "${RED}Error: Could not fetch JavaScript content.${NC}"
  exit 1
fi

echo -e "\n${BOLD}Checking API configuration:${NC}"

# Check for API URLs in the JavaScript
echo -e "\n1. Checking for hardcoded API URLs:"
if echo "$JS_CONTENT" | grep -q "USING ENVIRONMENT localhost"; then
  echo -e "  ${RED}✗${NC} Found localhost API configuration!"
  echo -e "  ${YELLOW}The frontend is still using localhost:3001 instead of production API${NC}"
else
  echo -e "  ${GREEN}✓${NC} No hardcoded localhost environment found"
fi

if echo "$JS_CONTENT" | grep -q "USING ENVIRONMENT https://api.ciroai.us"; then
  echo -e "  ${GREEN}✓${NC} Found correct production API configuration!"
else
  echo -e "  ${YELLOW}!${NC} Could not confirm production API configuration"
fi

echo -e "\n2. Checking for API URL variable:"
if echo "$JS_CONTENT" | grep -q "API_URL=\"https://api.ciroai.us\""; then
  echo -e "  ${GREEN}✓${NC} Found correct API_URL variable"
else
  echo -e "  ${YELLOW}!${NC} Could not confirm API_URL variable"
  echo -e "  This could be due to minification or variable naming"
fi

echo -e "\n${BOLD}${BLUE}=== Check Complete ===${NC}\n"

echo -e "If you're still having issues with API connectivity, please:"
echo -e "1. Clear your browser cache completely"
echo -e "2. Check that CloudFront invalidation has completed"
echo -e "3. Verify backend services are running correctly"
echo -e "4. Run the full verification script: ${BOLD}./verify-deployment.sh --all${NC}"
echo -e "" 