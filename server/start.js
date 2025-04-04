#!/usr/bin/env node

// This is a simple starter script to ensure paths are resolved correctly
const path = require('path');
const { spawn } = require('child_process');

// Log our current directory and target file
console.log('Current working directory:', process.cwd());

// Try multiple possible paths
const possiblePaths = [
  './dist/index.js',
  './dist/src/index.js',
  '/app/dist/index.js',
  '/app/dist/src/index.js',
  path.join(__dirname, 'dist/index.js'),
  path.join(__dirname, 'dist/src/index.js')
];

let foundPath = null;

for (const filePath of possiblePaths) {
  try {
    console.log(`Checking if file exists: ${filePath}`);
    require.resolve(filePath);
    foundPath = filePath;
    console.log(`Found file at: ${filePath}`);
    break;
  } catch (e) {
    console.log(`File not found at: ${filePath}`);
  }
}

if (!foundPath) {
  console.error('ERROR: Could not find index.js in any of the expected locations');
  process.exit(1);
}

// Start the application using the found path
console.log(`Starting application with: ${foundPath}`);
const child = spawn('node', [foundPath], { stdio: 'inherit' });

child.on('close', (code) => {
  process.exit(code);
}); 