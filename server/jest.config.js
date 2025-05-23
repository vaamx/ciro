const { pathsToModuleNameMapper } = require('ts-jest');
// Assuming tsconfig.json is in the same directory or a known relative path
// For server/jest.config.js, tsconfig.json is typically in the same directory or parent.
// Let's assume it's in the same directory for this example, adjust if needed.
const tsconfig = require('./tsconfig.json'); // Make sure this path is correct

const generatedMapper = pathsToModuleNameMapper(tsconfig.compilerOptions.paths || {}, {
  prefix: '<rootDir>/src/', // Prefix with <rootDir>/src/ because tsconfig baseUrl is "src"
});

// console.log('Generated ModuleNameMapper:', generatedMapper); // Removed log

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // rootDir should ideally be the project root where src is, 
  // or adjust prefix in pathsToModuleNameMapper accordingly.
  // If jest.config.js is in server/, and tsconfig.json baseUrl is src/,
  // then <rootDir> in moduleNameMapper below will point to server/
  // and prefix should account for src/ being inside server/ (e.g. <rootDir>/src/)
  // However, ts-jest recommends setting rootDir to the directory containing tsconfig.json
  // Let's ensure rootDir points to the 'server' directory itself if this config is server/jest.config.js
  rootDir: '.', // Explicitly set rootDir to the current directory (server/)
  roots: ['<rootDir>/src'], // This becomes './src' relative to server/
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: generatedMapper, // Use the logged mapper
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/migrations/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  verbose: true
}; 