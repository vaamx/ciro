#!/bin/bash

echo "Stopping any running server processes..."
pkill -f "node.*server/dist/index.js" || true

# Keep the embedding cache intact
# echo "Cleaning embedding cache directory..."
# rm -rf /home/vaamx/ciro-1/server/.cache/embeddings/*

echo "Setting environment variables..."
# Enable embedding cache for better reliability
export DISABLE_EMBEDDING_CACHE=false

echo "Starting server with embedding cache enabled..."
cd /home/vaamx/ciro-1/server
npm start

echo "Server started with embedding cache enabled!" 