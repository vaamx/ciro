#!/bin/bash
# Script to create RDS PostgreSQL instance

# Exit on error
set -e

# Load configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh first."
    exit 1
fi

source aws-config.env

# Default variables
DB_INSTANCE_CLASS="db.t3.small"
DB_USERNAME="***REMOVED***"
DB_NAME="ciro_db"
DB_STORAGE=20

# Parse command line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --instance-class)
      DB_INSTANCE_CLASS="$2"
      shift 2
      ;;
    --username)
      DB_USERNAME="$2"
      shift 2
      ;;
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --storage)
      DB_STORAGE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=== Creating RDS PostgreSQL instance ==="
echo "Region: $AWS_REGION"
echo "VPC ID: $VPC_ID"
echo "Security Group: $SG_RDS_ID"
echo "Subnets: $SUBNET1_ID, $SUBNET2_ID"

# Create DB subnet group
echo "Creating DB subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name "${STACK_NAME}-db-subnet-group" \
    --db-subnet-group-description "${STACK_NAME} DB subnet group" \
    --subnet-ids "[$SUBNET1_ID, $SUBNET2_ID]" \
    --region $AWS_REGION

# Generate a random password for the database
DB_PASSWORD=$(openssl rand -base64 16)

# Create the RDS instance
echo "Creating RDS instance..."
RDS_INSTANCE_ID=$(aws rds create-db-instance \
    --db-instance-identifier "${STACK_NAME}-db" \
    --db-instance-class $DB_INSTANCE_CLASS \
    --engine ***REMOVED*** \
    --engine-version 14 \
    --allocated-storage $DB_STORAGE \
    --master-username $DB_USERNAME \
    --master-user-password $DB_PASSWORD \
    --vpc-security-group-ids $SG_RDS_ID \
    --db-subnet-group-name "${STACK_NAME}-db-subnet-group" \
    --db-name $DB_NAME \
    --backup-retention-period 7 \
    --availability-zone "${AWS_REGION}a" \
    --enable-performance-insights \
    --no-multi-az \
    --storage-type gp2 \
    --no-publicly-accessible \
    --query 'DBInstance.DBInstanceIdentifier' \
    --output text \
    --region $AWS_REGION)

echo "RDS instance creation initiated: $RDS_INSTANCE_ID"
echo "This will take several minutes to complete."

# Wait for the database to become available
echo "Waiting for RDS instance to become available..."
aws rds wait db-instance-available \
    --db-instance-identifier $RDS_INSTANCE_ID \
    --region $AWS_REGION

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_INSTANCE_ID \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region $AWS_REGION)

echo "RDS instance created successfully!"
echo "Endpoint: $RDS_ENDPOINT"
echo "Username: $DB_USERNAME"
echo "Password: $DB_PASSWORD"
echo "Database: $DB_NAME"

# Save RDS information to configuration
cat >> aws-config.env << EOF
RDS_INSTANCE_ID=$RDS_INSTANCE_ID
RDS_ENDPOINT=$RDS_ENDPOINT
RDS_DB_NAME=$DB_NAME
RDS_USERNAME=$DB_USERNAME
RDS_PASSWORD=$DB_PASSWORD
EOF

echo "RDS configuration saved to aws-config.env"
echo "Done!" 