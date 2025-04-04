#!/bin/bash

# Script to fetch CloudWatch logs from AWS production environment

# Load AWS configuration
source ./aws-config.env

# Make sure AWS CLI is installed
command -v aws >/dev/null 2>&1 || { echo >&2 "AWS CLI is required but not installed. Aborting."; exit 1; }

# Set default values
HOURS_AGO=1
FILTER=""
OUTPUT_FORMAT="text"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --hours=*)
        HOURS_AGO="${1#*=}"
        shift
        ;;
        --filter=*)
        FILTER="${1#*=}"
        shift
        ;;
        --service=*)
        SERVICE="${1#*=}"
        shift
        ;;
        --format=*)
        OUTPUT_FORMAT="${1#*=}"
        shift
        ;;
        --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --hours=N           Fetch logs from the last N hours (default: 1)"
        echo "  --filter='TEXT'     Filter logs containing TEXT"
        echo "  --service=SERVICE   Specify service (backend, qdrant)"
        echo "  --format=FORMAT     Output format (text, json) default: text"
        echo "  --help              Show this help message"
        exit 0
        ;;
        *)
        echo "Unknown option: $1"
        echo "Use --help for usage information."
        exit 1
        ;;
    esac
done

# Set default service if not specified
if [ -z "$SERVICE" ]; then
    SERVICE="backend"
fi

# Calculate the time window for logs (in milliseconds since epoch)
START_TIME=$(date -d "-${HOURS_AGO} hours" +%s)
START_TIME=$(($START_TIME * 1000))
END_TIME=$(date +%s)
END_TIME=$(($END_TIME * 1000))

# Define log group name based on service
LOG_GROUP="/${STACK_NAME}/ecs/${SERVICE}"

echo "=== CIRO AWS Log Retrieval ==="
echo "Fetching logs for the ${SERVICE} service"
echo "Log group: ${LOG_GROUP}"
echo "Time range: Last ${HOURS_AGO} hour(s)"
if [ -n "$FILTER" ]; then
    echo "Filter: $FILTER"
fi
echo ""

# Get log streams sorted by last event time
LOG_STREAMS=$(aws logs describe-log-streams \
    --log-group-name "${LOG_GROUP}" \
    --order-by LastEventTime \
    --descending \
    --limit 5 \
    --output json)

if [ $? -ne 0 ]; then
    echo "Error: Failed to retrieve log streams. Make sure your AWS credentials are properly configured."
    exit 1
fi

# Extract the stream names
STREAM_NAMES=$(echo "$LOG_STREAMS" | jq -r '.logStreams[].logStreamName')

if [ -z "$STREAM_NAMES" ]; then
    echo "No log streams found in ${LOG_GROUP}"
    exit 1
fi

echo "Found the following log streams:"
echo "$STREAM_NAMES"
echo ""

# Loop through each stream and get logs
for STREAM in $STREAM_NAMES; do
    echo "=== Logs from stream: $STREAM ==="
    
    # Create AWS CLI command
    if [ -n "$FILTER" ]; then
        # Using AWS CLI's built-in filtering
        aws logs filter-log-events \
            --log-group-name "${LOG_GROUP}" \
            --log-stream-names "${STREAM}" \
            --start-time "${START_TIME}" \
            --end-time "${END_TIME}" \
            --filter-pattern "${FILTER}" \
            --output json | jq -r '.events[] | "\(.timestamp/1000 | strftime("%Y-%m-%d %H:%M:%S")) \(.message)"'
    else
        # Get all logs
        aws logs get-log-events \
            --log-group-name "${LOG_GROUP}" \
            --log-stream-name "${STREAM}" \
            --start-time "${START_TIME}" \
            --end-time "${END_TIME}" \
            --output json | jq -r '.events[] | "\(.timestamp/1000 | strftime("%Y-%m-%d %H:%M:%S")) \(.message)"'
    fi
    
    echo ""
done

echo "=== Log Retrieval Complete ==="
echo "For more detailed log exploration, use the AWS CloudWatch console at:"
echo "https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${LOG_GROUP//\//\%2F}"
echo ""
echo "If you don't see the logs you're looking for, try setting different filter keywords"
echo "or access the CloudWatch console directly for a more comprehensive view." 