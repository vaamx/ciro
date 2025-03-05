import { createLogger } from '../utils/logger';
import dotenv from 'dotenv';
import { shouldLogInitialization } from '../utils/logger-config';

// Load environment variables from .env file
dotenv.config();

/**
 * Simple configuration service to provide access to environment variables
 */
export class ConfigService {
  private readonly logger = createLogger('ConfigService');
  private readonly envCache: Record<string, string | undefined> = {};
  
  // Add singleton implementation
  private static instance: ConfigService | null = null;
  private static constructorCallCount = 0;
  
  /**
   * Get the singleton instance of ConfigService
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  
  /**
   * Get the count of constructor calls for diagnostics
   */
  public static getConstructorCallCount(): number {
    return ConfigService.constructorCallCount;
  }

  constructor() {
    ConfigService.constructorCallCount++;
    
    // Warn if constructor is called multiple times
    if (ConfigService.constructorCallCount > 1) {
      this.logger.warn(`⚠️ Warning: ConfigService constructor called ${ConfigService.constructorCallCount} times. Use ConfigService.getInstance() instead.`);
      if (ConfigService.instance) {
        return ConfigService.instance;
      }
    }
    
    if (shouldLogInitialization('ConfigService')) {
      this.logger.info('ConfigService initialized');
    }
  }

  /**
   * Get an environment variable
   * @param key The environment variable key
   * @param defaultValue Optional default value if the environment variable is not set
   * @returns The environment variable value or the default value
   */
  get(key: string, defaultValue?: string): string | undefined {
    // Check cache first
    if (this.envCache[key] !== undefined) {
      return this.envCache[key];
    }

    // Get from environment
    const value = process.env[key] || defaultValue;
    
    // Cache the result
    this.envCache[key] = value;
    
    return value;
  }

  /**
   * Get an environment variable as a number
   * @param key The environment variable key
   * @param defaultValue Optional default value if the environment variable is not set or not a valid number
   * @returns The environment variable value as a number or the default value
   */
  getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.get(key);
    
    if (value === undefined) {
      return defaultValue;
    }
    
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      this.logger.warn(`Environment variable ${key} is not a valid number: ${value}`);
      return defaultValue;
    }
    
    return numValue;
  }

  /**
   * Get an environment variable as a boolean
   * @param key The environment variable key
   * @param defaultValue Optional default value if the environment variable is not set
   * @returns The environment variable value as a boolean or the default value
   */
  getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.get(key);
    
    if (value === undefined) {
      return defaultValue;
    }
    
    return value.toLowerCase() === 'true';
  }
}

// Export a singleton instance
export const configService = ConfigService.getInstance(); 