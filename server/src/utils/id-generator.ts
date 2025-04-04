import { v4 as uuidv4 } from 'uuid';
import { createLogger } from './logger';

const logger = createLogger('IdGenerator');

/**
 * Generate a unique ID for various entities
 */
export class IdGenerator {
  /**
   * Generate a UUID v4
   * @returns Unique UUID string
   */
  static generateUuid(): string {
    return uuidv4();
  }

  /**
   * Generate a unique numeric-like ID with a timestamp prefix
   * @returns Numeric-like ID string
   */
  static generateNumericId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${timestamp}${random}`;
  }

  /**
   * Generate a valid data source ID that works with the system
   * @param prefix Optional prefix for the ID
   * @returns Data source ID
   */
  static generateDataSourceId(prefix: string = 'ds'): string {
    const uuid = this.generateUuid();
    // Use a shortened UUID with a prefix
    return `${prefix}_${uuid.split('-')[0]}`;
  }

  /**
   * Generate a fallback ID for use when database operations fail
   * @param entityType Type of entity (file, datasource, etc.)
   * @returns Fallback ID with prefix
   */
  static generateFallbackId(entityType: string): string {
    const id = this.generateNumericId();
    logger.warn(`Generated fallback ID for ${entityType}: ${id}`);
    return `fallback_${entityType}_${id}`;
  }
} 