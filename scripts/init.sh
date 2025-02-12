#!/bin/bash

echo "Initializing Ciro AI infrastructure..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready!"

# Initialize PostgreSQL extensions and tables
echo "Initializing PostgreSQL extensions and tables..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB << EOF
  -- Enable necessary extensions
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "vector";

  -- Create tables
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id),
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(type);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
EOF

echo "PostgreSQL initialization complete!"

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
until echo "quit" | nc localhost 9092; do
  echo "Kafka is unavailable - sleeping"
  sleep 1
done

echo "Kafka is ready!"

# Create Kafka topics
echo "Creating Kafka topics..."
kafka-topics.sh --create --if-not-exists --bootstrap-server localhost:9092 --topic chat-messages --partitions 3 --replication-factor 1
kafka-topics.sh --create --if-not-exists --bootstrap-server localhost:9092 --topic data-requests --partitions 3 --replication-factor 1
kafka-topics.sh --create --if-not-exists --bootstrap-server localhost:9092 --topic visualization-requests --partitions 3 --replication-factor 1
kafka-topics.sh --create --if-not-exists --bootstrap-server localhost:9092 --topic llm-requests --partitions 3 --replication-factor 1

echo "Kafka topics created successfully!"

echo "Infrastructure initialization complete!" 