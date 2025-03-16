#!/bin/bash

# Run the aggregation generator test
echo "Running aggregation generator test..."
node src/tests/aggregation-generator.test.js

# Check if the test succeeded
if [ $? -eq 0 ]; then
  echo "Aggregation generator test completed successfully!"
  
  # Display the test results
  if [ -f "src/tests/aggregation-test-results.json" ]; then
    echo "Test results summary:"
    cat src/tests/aggregation-test-results.json | grep -v "vector" | head -30
    echo "..."
    echo "Full results available in src/tests/aggregation-test-results.json"
  else
    echo "Warning: Test results file not found."
  fi
else
  echo "Error: Aggregation generator test failed!"
  exit 1
fi 