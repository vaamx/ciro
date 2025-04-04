#!/bin/bash
# ============================================================
# CIRO Full Deployment Script
# ============================================================
# This script handles a complete deployment of CIRO
# It can deploy the frontend, backend, or both
# ============================================================

# Exit on error
set -e

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# FUNCTION DEFINITIONS
# ============================================================

display_help() {
  echo -e "${BOLD}CIRO Full Deployment Script${NC}"
  echo ""
  echo "Usage: ./deploy-full.sh [options]"
  echo ""
  echo "Options:"
  echo "  --frontend-only    Deploy only the frontend"
  echo "  --backend-only     Deploy only the backend"
  echo "  --skip-verify      Skip the verification step"
  echo "  --help             Display this help message"
  echo ""
  echo "If no options are provided, both frontend and backend will be deployed."
}

# ============================================================
# ARGUMENT PARSING
# ============================================================

DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true
SKIP_VERIFY=false

for arg in "$@"; do
  case $arg in
    --frontend-only)
      DEPLOY_FRONTEND=true
      DEPLOY_BACKEND=false
      shift
      ;;
    --backend-only)
      DEPLOY_FRONTEND=false
      DEPLOY_BACKEND=true
      shift
      ;;
    --skip-verify)
      SKIP_VERIFY=true
      shift
      ;;
    --help)
      display_help
      exit 0
      ;;
  esac
done

# ============================================================
# SCRIPT LOGIC
# ============================================================

echo -e "\n${BOLD}${BLUE}=== CIRO Full Deployment Pipeline ===${NC}\n"

echo -e "Deployment configuration:"
if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_BACKEND" = true ]; then
  echo -e "• Deploying: ${BOLD}Frontend and Backend${NC}"
elif [ "$DEPLOY_FRONTEND" = true ]; then
  echo -e "• Deploying: ${BOLD}Frontend only${NC}"
elif [ "$DEPLOY_BACKEND" = true ]; then
  echo -e "• Deploying: ${BOLD}Backend only${NC}"
fi

if [ "$SKIP_VERIFY" = true ]; then
  echo -e "• Verification: ${YELLOW}Skipped${NC}"
else
  echo -e "• Verification: ${GREEN}Enabled${NC}"
fi

echo ""

# Check if deployment scripts exist
if [ ! -f "deploy-frontend.sh" ] || [ ! -f "deploy-backend.sh" ]; then
  echo -e "${RED}Error:${NC} Required deployment scripts are missing."
  echo "Please ensure deploy-frontend.sh and deploy-backend.sh exist in the current directory."
  exit 1
fi

# Make scripts executable
chmod +x deploy-frontend.sh deploy-backend.sh

# Deploy backend
if [ "$DEPLOY_BACKEND" = true ]; then
  echo -e "\n${BOLD}${BLUE}=== Deploying Backend ===${NC}"
  ./deploy-backend.sh
  BACKEND_RESULT=$?
  
  if [ $BACKEND_RESULT -ne 0 ]; then
    echo -e "\n${RED}Backend deployment failed with exit code $BACKEND_RESULT${NC}"
    exit $BACKEND_RESULT
  fi
  
  echo -e "\n${GREEN}${BOLD}Backend deployment completed successfully${NC}"
fi

# Deploy frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
  echo -e "\n${BOLD}${BLUE}=== Deploying Frontend ===${NC}"
  ./deploy-frontend.sh
  FRONTEND_RESULT=$?
  
  if [ $FRONTEND_RESULT -ne 0 ]; then
    echo -e "\n${RED}Frontend deployment failed with exit code $FRONTEND_RESULT${NC}"
    exit $FRONTEND_RESULT
  fi
  
  echo -e "\n${GREEN}${BOLD}Frontend deployment completed successfully${NC}"
fi

# Create verify deployment script if it doesn't exist
if [ ! -f "verify-deployment.sh" ] && [ "$SKIP_VERIFY" = false ]; then
  echo -e "\n${YELLOW}Warning:${NC} verify-deployment.sh not found. Creating it now..."
  
  cat > verify-deployment.sh << 'EOF'
#!/bin/bash
# Simplified verification script for CIRO deployments

# Exit on error
set -e

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Set API URLs
API_URL="https://api.ciroai.us"
APP_URL="https://app.ciroai.us"

# Parse arguments
VERIFY_FRONTEND=false
VERIFY_BACKEND=false

for arg in "$@"; do
  case $arg in
    --frontend)
      VERIFY_FRONTEND=true
      shift
      ;;
    --backend)
      VERIFY_BACKEND=true
      shift
      ;;
    --all)
      VERIFY_FRONTEND=true
      VERIFY_BACKEND=true
      shift
      ;;
    --help)
      echo -e "${BOLD}CIRO Deployment Verification Script${NC}"
      echo ""
      echo "Usage: ./verify-deployment.sh [options]"
      echo ""
      echo "Options:"
      echo "  --frontend       Verify frontend deployment"
      echo "  --backend        Verify backend deployment"
      echo "  --all            Verify both frontend and backend"
      echo "  --help           Display this help message"
      echo ""
      exit 0
      ;;
  esac
done

# If no specific verification was selected, verify both
if [ "$VERIFY_FRONTEND" = false ] && [ "$VERIFY_BACKEND" = false ]; then
  VERIFY_FRONTEND=true
  VERIFY_BACKEND=true
fi

echo -e "\n${BOLD}=== CIRO Deployment Verification ===${NC}\n"

# Verify backend
if [ "$VERIFY_BACKEND" = true ]; then
  echo -e "${BOLD}Verifying Backend Deployment:${NC}"
  echo -e "  • Testing API health endpoint..."
  
  HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/api/health || echo "failed")
  
  if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} API health endpoint is responding (200 OK)"
  else
    echo -e "  ${RED}✗${NC} API health endpoint failed to respond: $HEALTH_RESPONSE"
    echo -e "    Try manually accessing ${BOLD}${API_URL}/api/health${NC} in your browser"
  fi
  
  echo -e "  • Checking API version..."
  VERSION_RESPONSE=$(curl -s ${API_URL}/api/version || echo "failed")
  
  if [ "$VERSION_RESPONSE" != "failed" ]; then
    echo -e "  ${GREEN}✓${NC} API version endpoint is responding: $VERSION_RESPONSE"
  else
    echo -e "  ${RED}✗${NC} API version endpoint failed to respond"
  fi
  
  echo -e "\n  To perform a complete backend verification with authentication, run:"
  echo -e "  ${BOLD}./verify-auth-fixes.sh${NC}"
fi

# Verify frontend
if [ "$VERIFY_FRONTEND" = true ]; then
  echo -e "\n${BOLD}Verifying Frontend Deployment:${NC}"
  echo -e "  • Testing frontend accessibility..."
  
  APP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${APP_URL} || echo "failed")
  
  if [ "$APP_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Frontend is accessible (200 OK)"
  else
    echo -e "  ${RED}✗${NC} Frontend failed to respond: $APP_RESPONSE"
    echo -e "    Try manually accessing ${BOLD}${APP_URL}${NC} in your browser"
  fi
  
  echo -e "\n  Manual frontend verification required:"
  echo -e "  1. Open ${BOLD}${APP_URL}${NC} in your browser"
  echo -e "  2. Log in with your credentials"
  echo -e "  3. Verify basic functionality (navigation, dashboards, chat)"
fi

echo -e "\n${BOLD}=== Verification Complete ===${NC}\n"
EOF
  
  chmod +x verify-deployment.sh
  echo -e "${GREEN}✓${NC} Created verify-deployment.sh"
fi

# Run verification
if [ "$SKIP_VERIFY" = false ]; then
  echo -e "\n${BOLD}${BLUE}=== Verifying Deployment ===${NC}"
  
  if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_BACKEND" = true ]; then
    ./verify-deployment.sh --all
  elif [ "$DEPLOY_FRONTEND" = true ]; then
    ./verify-deployment.sh --frontend
  elif [ "$DEPLOY_BACKEND" = true ]; then
    ./verify-deployment.sh --backend
  fi
  
  echo -e "\n${GREEN}${BOLD}Verification completed${NC}"
else
  echo -e "\n${YELLOW}Skipping verification as requested${NC}"
fi

echo -e "\n${GREEN}${BOLD}=== CIRO Deployment Completed Successfully ===${NC}\n"
echo -e "Frontend URL: ${BOLD}https://app.ciroai.us${NC}"
echo -e "Backend API: ${BOLD}https://api.ciroai.us${NC}"
echo -e "\nThank you for using the CIRO Deployment Pipeline!\n" 