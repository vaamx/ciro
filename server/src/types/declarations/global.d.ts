/**
 * Global type declarations for the application
 */

// Allow string to be assigned to ModelName in OpenAI service
declare namespace OpenAI {
  type ModelName = string;
}

// Extend certain problematic types
declare global {
  // This ensures type compatibility for model names in the entire application
  interface ModelConfiguration {
    name: string;
    promptTokenLimit: number;
    completionTokenLimit: number;
    context: number;
  }
}

export {}; 