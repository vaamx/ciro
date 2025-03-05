/**
 * Test script for document processors
 * 
 * This script tests the document processor factory and collection naming
 * to ensure consistent behavior across the system.
 * 
 * Run with: npx ts-node src/scripts/test-processors.js
 */

// Fix imports to work with TypeScript
import { DocumentProcessorFactory } from '../services/document-processors/document-processor-factory';
import path from 'path';

// Test files with different extensions
const testFiles = [
  { path: '/tmp/test.pdf', description: 'PDF file' },
  { path: '/tmp/test.docx', description: 'DOCX file' },
  { path: '/tmp/test.xlsx', description: 'Excel file' },
  { path: '/tmp/test.csv', description: 'CSV file' },
  { path: '/tmp/unknown.abc', description: 'Unknown file type' },
];

// Test data source IDs with different formats
const testDataSourceIds = [
  { id: '123', description: 'Plain ID' },
  { id: 'datasource_456', description: 'Prefixed with datasource_' },
  { id: 'data_source_789', description: 'Prefixed with data_source_' },
  { id: 'my-data-source', description: 'With hyphens' },
  { id: 'my_data_source', description: 'With underscores' },
];

// Processing methods to test
const processingMethods = [
  'auto',
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'csv-processor',
  'unknown-method',
];

// Initialize the factory
const factory = new DocumentProcessorFactory();
console.log('Document processor factory initialized');
console.log(`Registered processors: ${factory.getRegisteredTypes().join(', ')}`);
console.log();

// Test collection name normalization
console.log('Testing collection name normalization:');
console.log('=====================================');
testDataSourceIds.forEach(({ id, description }) => {
  const normalizedName = factory.normalizeCollectionName(id);
  console.log(`${description}: ${id} -> ${normalizedName}`);
});
console.log();

// Test processor selection by file path
console.log('Testing processor selection by file path:');
console.log('=======================================');
testFiles.forEach(({ path: filePath, description }) => {
  try {
    const processor = factory.getProcessorByPath(filePath);
    const processorName = processor ? processor.constructor.name : 'No processor found';
    console.log(`${description}: ${filePath} -> ${processorName}`);
  } catch (error) {
    console.log(`${description}: ${filePath} -> ERROR: ${error.message}`);
  }
});
console.log();

// Test processor selection by processing method
console.log('Testing processor selection by processing method:');
console.log('=============================================');
processingMethods.forEach((method) => {
  try {
    const processor = factory.getProcessorByFileType(method);
    const processorName = processor ? processor.constructor.name : 'No processor found';
    console.log(`Method "${method}" -> ${processorName}`);
  } catch (error) {
    console.log(`Method "${method}" -> ERROR: ${error.message}`);
  }
}); 