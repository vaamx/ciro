#!/bin/bash

echo "Checking health of Ciro AI services..."

# Check PostgreSQL
echo -n "PostgreSQL: "
if PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c '\q' 2>/dev/null; then
    echo "✅ Connected"
else
    echo "❌ Failed to connect"
fi

# Check Kafka
echo -n "Kafka: "
if echo "quit" | nc localhost 9092 2>/dev/null; then
    echo "✅ Connected"
else
    echo "❌ Failed to connect"
fi

# Check Backend API
echo -n "Backend API: "
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Check Frontend
echo -n "Frontend: "
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Check Supabase Connection
echo -n "Supabase: "
if curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY" > /dev/null; then
    echo "✅ Connected"
else
    echo "❌ Failed to connect"
fi

# Check Docker containers
echo -n "Docker Containers: "
if docker ps --format '{{.Names}}' | grep -q 'ciro'; then
    echo "✅ Running"
    echo "Running containers:"
    docker ps --format 'table {{.Names}}\t{{.Status}}' | grep 'ciro'
else
    echo "❌ No containers found"
fi

# Check Kafka Topics
echo "Kafka Topics:"
kafka-topics.sh --list --bootstrap-server localhost:9092 2>/dev/null || echo "❌ Failed to list topics"

echo "Health check complete!" 