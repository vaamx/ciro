#!/bin/bash
# ============================================================
# CIRO Frontend Deployment Script
# ============================================================
# This script handles all frontend deployments to AWS S3/CloudFront
# It builds the frontend app and deploys it to the production environment
# ============================================================

# Exit on error
set -e

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================
# CONFIGURATION
# ============================================================

# Load AWS configuration
if [ -f aws-config.env ]; then
  source aws-config.env
  echo -e "${GREEN}✓${NC} Loaded AWS configuration from aws-config.env"
else
  # Hardcoded fallback values
  S3_BUCKET_NAME="ciro-stack-frontend-1742157621"
  CLOUDFRONT_DISTRIBUTION_ID="E1G2DAXIDHKMCQ"
  echo -e "${YELLOW}!${NC} Using hardcoded configuration values:"
  echo -e "  • S3 bucket: ${BOLD}$S3_BUCKET_NAME${NC}"
  echo -e "  • CloudFront distribution: ${BOLD}$CLOUDFRONT_DISTRIBUTION_ID${NC}"
fi

# Working directory paths
WORKSPACE_DIR="/home/vaamx/ciro-1"
DASHBOARD_DIR="$WORKSPACE_DIR/dashboard"
DIST_DIR="$DASHBOARD_DIR/dist"

# ============================================================
# COMMAND LINE ARGUMENTS
# ============================================================

# Parse arguments
SKIP_BUILD=false
SKIP_INVALIDATION=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-invalidation)
      SKIP_INVALIDATION=true
      shift
      ;;
    --help)
      echo -e "${BOLD}CIRO Frontend Deployment Script${NC}"
      echo ""
      echo "Usage: ./deploy-frontend.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-build        Skip the build step (use if you've already built locally)"
      echo "  --skip-invalidation Skip CloudFront cache invalidation"
      echo "  --help              Display this help message"
      echo ""
      exit 0
      ;;
  esac
done

# ============================================================
# DEPLOYMENT PROCESS
# ============================================================

echo -e "\n${BOLD}=== CIRO Frontend Deployment ===${NC}\n"

# Step 1: Build the frontend application
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${BOLD}Step 1:${NC} Building frontend application..."
  cd $DASHBOARD_DIR
  
  # Set production API URL for the build
  export VITE_API_URL="https://api.ciroai.us"
  export VITE_FRONTEND_URL="https://app.ciroai.us"
  echo -e "🔧 Setting production environment variables:"
  echo -e "  • API URL: ${BOLD}$VITE_API_URL${NC}"
  echo -e "  • Frontend URL: ${BOLD}$VITE_FRONTEND_URL${NC}"
  
  npm run build
  echo -e "${GREEN}✓${NC} Build completed successfully"
else
  echo -e "${YELLOW}!${NC} Skipping build step as requested"
fi

# Step 2: Sync built files to S3
echo -e "\n${BOLD}Step 2:${NC} Uploading to S3 bucket..."
if aws s3 sync $DIST_DIR s3://$S3_BUCKET_NAME --delete; then
  echo -e "${GREEN}✓${NC} Frontend files successfully uploaded to S3 bucket: ${BOLD}$S3_BUCKET_NAME${NC}"
else
  echo -e "${RED}✗${NC} Failed to upload frontend files to S3"
  exit 1
fi

# Step 3: Invalidate CloudFront cache
if [ "$SKIP_INVALIDATION" = false ]; then
  echo -e "\n${BOLD}Step 3:${NC} Invalidating CloudFront cache..."
  if aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"; then
    echo -e "${GREEN}✓${NC} CloudFront cache invalidation initiated"
    echo -e "  It may take a few minutes for changes to propagate"
  else
    echo -e "${YELLOW}!${NC} Failed to invalidate CloudFront cache"
    echo -e "  You may need to manually invalidate the cache later"
  fi
else
  echo -e "\n${YELLOW}!${NC} Skipping CloudFront invalidation as requested"
fi

# ============================================================
# DEPLOYMENT SUMMARY
# ============================================================

echo -e "\n${BOLD}=== Deployment Complete ===${NC}\n"
echo -e "${GREEN}✓${NC} Frontend deployed successfully to production"
echo -e "\n${BOLD}Verification Steps:${NC}"
echo -e "1. Open your browser to ${BOLD}https://app.ciroai.us${NC}"
echo -e "2. Login with your credentials"
echo -e "3. Verify the application works correctly"
echo -e "\n${BOLD}Use the verification script:${NC}"
echo -e "./verify-deployment.sh --frontend\n" 