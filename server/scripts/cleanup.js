// Cleanup script for the server directory
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

// Directories to clean
const TEMP_DIRS = [
  'temp',
  'uploads',
  'ocr-results',
  'extraction-results',
  'debug',
  'logs',
  'cache/unstructured',
  '.cache/embeddings',
  '.cache/unstructured'
];

// File age threshold (in milliseconds)
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

async function cleanDirectory(dirPath) {
  try {
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      console.log(`Directory ${dirPath} does not exist, skipping.`);
      return;
    }

    // Get all files in the directory
    const files = await readdir(dirPath);
    let removedCount = 0;
    let totalSize = 0;

    console.log(`Cleaning directory: ${dirPath}`);

    // Process each file
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const fileStat = await stat(filePath);
        
        // If it's a directory, recursively clean it
        if (fileStat.isDirectory()) {
          // Recursively clean subdirectories but don't delete them
          await cleanDirectory(filePath);
          continue;
        }
        
        // Check file age
        const fileAge = Date.now() - fileStat.mtime.getTime();
        
        if (fileAge > MAX_AGE) {
          const fileSize = fileStat.size;
          await unlink(filePath);
          removedCount++;
          totalSize += fileSize;
          console.log(`Removed: ${filePath} (${formatBytes(fileSize)})`);
        }
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
      }
    }
    
    console.log(`Cleaned ${dirPath}: removed ${removedCount} files (${formatBytes(totalSize)})`);
  } catch (err) {
    console.error(`Error cleaning directory ${dirPath}:`, err.message);
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function main() {
  console.log('Starting cleanup process...');
  
  // Process each directory in parallel
  await Promise.all(
    TEMP_DIRS.map(dir => cleanDirectory(path.resolve(process.cwd(), dir)))
  );
  
  console.log('Cleanup completed.');
}

// Run the cleanup
main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
}); 