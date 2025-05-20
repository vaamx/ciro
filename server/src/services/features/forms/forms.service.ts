import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { IFormsStrategy, FormSchema, ConnectionTestResult } from './forms.strategy.interface';

// Injection token for the strategy map
export const FORMS_STRATEGY_MAP = 'FORMS_STRATEGY_MAP';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    // Inject a map where keys are dataSourceType (string) and values are IFormsStrategy instances
    @Inject(FORMS_STRATEGY_MAP)
    private readonly strategyMap: Map<string, IFormsStrategy>
  ) {
    this.logger.log(`FormsService initialized with ${this.strategyMap.size} strategies.`);
  }

  /**
   * Get the appropriate strategy for a given data source type.
   */
  private getStrategy(dataSourceType: string): IFormsStrategy {
    const strategy = this.strategyMap.get(dataSourceType.toLowerCase());
    if (!strategy) {
      this.logger.error(`No forms strategy found for data source type: ${dataSourceType}`);
      throw new NotFoundException(`Unsupported data source type for forms: ${dataSourceType}`);
    }
    return strategy;
  }

  /**
   * Get the form schema for connecting to a specific data source type.
   */
  async getFormSchema(dataSourceType: string): Promise<FormSchema> {
    this.logger.log(`Getting form schema for data source type: ${dataSourceType}`);
    const strategy = this.getStrategy(dataSourceType);
    return strategy.getFormSchema();
  }

  /**
   * Test the connection for a specific data source type using provided credentials.
   */
  async testConnection(dataSourceType: string, credentials: Record<string, any>): Promise<ConnectionTestResult> {
    this.logger.log(`Testing connection for data source type: ${dataSourceType}`);
    const strategy = this.getStrategy(dataSourceType);
    // Basic validation
    if (!credentials || typeof credentials !== 'object') {
      return { success: false, message: 'Invalid credentials format.' };
    }
    return strategy.testConnection(credentials);
  }

  /**
   * List available resources (e.g., databases, warehouses) for a connection, if supported.
   * This acts as a generic dispatcher to optional strategy methods.
   */
  async listResources(dataSourceType: string, resourceType: 'warehouses' | 'databases' | 'schemas' | 'tables' | 'roles', credentials: Record<string, any>, context?: { database?: string; schema?: string }): Promise<string[]> {
    this.logger.log(`Listing resource type '${resourceType}' for data source type: ${dataSourceType}`);
    const strategy = this.getStrategy(dataSourceType);

    switch (resourceType) {
      case 'warehouses':
        if (strategy.listWarehouses) {
          return strategy.listWarehouses(credentials);
        } else {
          this.logger.warn(`listWarehouses not supported for ${dataSourceType}`);
          return [];
        }
      case 'databases':
        if (strategy.listDatabases) {
          return strategy.listDatabases(credentials);
        } else {
          this.logger.warn(`listDatabases not supported for ${dataSourceType}`);
          return [];
        }
      case 'schemas':
        if (strategy.listSchemas && context?.database) {
          return strategy.listSchemas(credentials, context.database);
        } else if (!context?.database) {
          throw new Error('Database context is required to list schemas.');
        } else {
          this.logger.warn(`listSchemas not supported for ${dataSourceType}`);
          return [];
        }
       case 'tables':
        if (strategy.listTables && context?.database && context?.schema) {
          return strategy.listTables(credentials, context.database, context.schema);
        } else if (!context?.database || !context?.schema) {
          throw new Error('Database and schema context are required to list tables.');
        } else {
          this.logger.warn(`listTables not supported for ${dataSourceType}`);
          return [];
        }
      case 'roles':
        if (strategy.listRoles) {
          return strategy.listRoles(credentials);
        } else {
          this.logger.warn(`listRoles not supported for ${dataSourceType}`);
          return [];
        }
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }
  }
} 