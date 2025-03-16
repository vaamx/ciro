#!/bin/bash

echo "Running Phase 3 Integration Test"
echo "===============================\n"

# Set the working directory to the project root
cd $(dirname "$0")/../..

# Run the test
node src/tests/integration-test.js

# Check the exit code
if [ $? -eq 0 ]; then
  echo "\nPhase 3 Integration Test completed successfully."
  
  # Display test results if available
  if [ -f "src/tests/phase3-test-results.json" ]; then
    echo "\nTest Results Summary:"
    # Extract and display relevant parts of the results
    cat src/tests/phase3-test-results.json | grep -v "vector" | head -30
    echo "..."
    echo "Full results available in src/tests/phase3-test-results.json"
  fi
else
  echo "\nPhase 3 Integration Test failed!"
  exit 1
fi 