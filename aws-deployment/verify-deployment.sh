#!/bin/bash
# ============================================================
# CIRO Deployment Verification Script
# ============================================================
# This script verifies that both frontend and backend
# deployments are working properly
# ============================================================

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

# ============================================================
# COMMAND LINE ARGUMENTS
# ============================================================

# Parse arguments
VERIFY_FRONTEND=false
VERIFY_BACKEND=false
VERIFY_AUTH=false

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
    --auth)
      VERIFY_AUTH=true
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
      echo "  --auth           Verify authentication (requires credentials)"
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

# ============================================================
# VERIFICATION PROCESS
# ============================================================

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
  
  echo -e "  • Testing API database connection..."
  DB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/api/health/db || echo "failed")
  
  if [ "$DB_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Database connection is working (200 OK)"
  else
    echo -e "  ${YELLOW}!${NC} Database health check failed or not available: $DB_RESPONSE"
  fi
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
  
  echo -e "  • Checking for critical frontend assets..."
  
  # Check for main JavaScript bundle
  JS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${APP_URL}/assets/index-*.js || echo "failed")
  
  if [ "$JS_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Main JavaScript bundle is accessible"
  else
    echo -e "  ${YELLOW}!${NC} Failed to find main JavaScript bundle"
  fi
  
  # Check for CSS
  CSS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${APP_URL}/assets/index-*.css || echo "failed")
  
  if [ "$CSS_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} CSS styles are accessible"
  else
    echo -e "  ${YELLOW}!${NC} Failed to find CSS styles"
  fi
fi

# Verify authentication
if [ "$VERIFY_AUTH" = true ]; then
  echo -e "\n${BOLD}Verifying Authentication:${NC}"
  
  # Check if verify-auth-fixes.sh exists
  if [ -f "verify-auth-fixes.sh" ]; then
    echo -e "  • Found dedicated authentication verification script"
    echo -e "  • Running authentication tests..."
    ./verify-auth-fixes.sh
  else
    echo -e "  • Requesting credentials for authentication testing..."
    echo -e "    ${YELLOW}Please enter your test email:${NC}"
    read TEST_EMAIL
    echo -e "    ${YELLOW}Please enter your test password:${NC}"
    read -s TEST_PASSWORD
    echo ""
    
    # Get the auth token
    echo -e "  • Testing login endpoint..."
    TOKEN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
      -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}" \
      "${API_URL}/api/auth/login")
    
    # Extract token
    AUTH_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$AUTH_TOKEN" ]; then
      echo -e "  ${RED}✗${NC} Failed to get authentication token"
      echo -e "    Response: $TOKEN_RESPONSE"
    else
      echo -e "  ${GREEN}✓${NC} Successfully authenticated"
      echo -e "    Token: ${AUTH_TOKEN:0:10}..." # Show first 10 chars for security
      
      # Test getting user profile with token
      echo -e "  • Testing authenticated endpoint (user profile)..."
      PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "${API_URL}/api/auth/me")
      
      USER_ID=$(echo $PROFILE_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)
      
      if [ -z "$USER_ID" ]; then
        echo -e "  ${RED}✗${NC} Failed to get user profile"
        echo -e "    Response: $PROFILE_RESPONSE"
      else
        echo -e "  ${GREEN}✓${NC} Successfully retrieved user profile"
        echo -e "    User ID: $USER_ID"
      fi
    fi
  fi
fi

# Manual verification guidance
echo -e "\n${BOLD}Manual Verification Steps:${NC}"
echo -e "1. Open ${BOLD}${APP_URL}${NC} in your browser"
echo -e "2. Log in with your credentials"
echo -e "3. Verify the following functionality:"
echo -e "   • Create a new dashboard"
echo -e "   • Access an existing dashboard"
echo -e "   • Create a chat session"
echo -e "   • Send and receive messages"
echo -e "   • Ensure you don't get unexpectedly logged out"

echo -e "\n${BOLD}=== Verification Complete ===${NC}\n" 