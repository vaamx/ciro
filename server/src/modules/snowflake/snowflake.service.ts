import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException, Inject, Optional } from '@nestjs/common';
import { SnowflakeConnectionParams } from './interfaces/snowflake-connection.interface';
import { SnowflakeNLQueryService } from '../../services/features/nl-query/snowflake/snowflake-nl-query.service';

@Injectable()
export class SnowflakeService {
  private legacyService: any; // Holds the connector service instance
  
  constructor(
    private readonly logger: Logger,
    @Optional() private readonly nlQueryService?: SnowflakeNLQueryService
  ) {
    // Logger.setContext is a method on LoggerService, not Logger
    // Using string context in log methods instead
    try {
      // Corrected dynamic import path
      const { SnowflakeService: ConnectorSnowflakeService } = require('../../services/datasources/connectors/snowflake/snowflake.service');
      this.legacyService = ConnectorSnowflakeService.getInstance(); // Assuming getInstance exists
      this.logger.log('SnowflakeService (Module) initialized with Connector service instance', 'SnowflakeService');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize legacy Snowflake service: ${errorMessage}`, 'SnowflakeService');
      throw new InternalServerErrorException('Failed to initialize Snowflake service');
    }
  }

  /**
   * Test a connection to Snowflake
   */
  async testConnection(connectionParams: SnowflakeConnectionParams) {
    try {
      this.validateConnectionParams(connectionParams);
      
      // Create a temporary connection for testing
      const connectionResult = await this.legacyService.createConnection(
        0, // Temporary ID, won't be stored
        connectionParams
      );

      if (connectionResult.success) {
        // Close the connection since it was just for testing
        await this.legacyService.closeConnection(0);
      }

      return connectionResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error testing Snowflake connection: ${errorMessage}`, 'SnowflakeService');
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to test connection: ${errorMessage}`);
    }
  }

  /**
   * List available databases in a Snowflake data source
   */
  async listDatabases(dataSourceId: number) {
    try {
      const databases = await this.legacyService.listDatabases(dataSourceId);
      return { databases };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing Snowflake databases: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Data source with ID ${dataSourceId} not found`);
      }
      throw new InternalServerErrorException(`Failed to list databases: ${errorMessage}`);
    }
  }

  /**
   * List available schemas in a Snowflake database
   */
  async listSchemas(dataSourceId: number, database: string) {
    try {
      const schemas = await this.legacyService.listSchemas(dataSourceId, database);
      return { schemas };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing Snowflake schemas: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Data source with ID ${dataSourceId} or database ${database} not found`);
      }
      throw new InternalServerErrorException(`Failed to list schemas: ${errorMessage}`);
    }
  }

  /**
   * List available tables in a Snowflake schema
   */
  async listTables(dataSourceId: number, database: string, schema: string) {
    try {
      const tables = await this.legacyService.listTables(dataSourceId, database, schema);
      return { tables };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing Snowflake tables: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Data source, database, or schema not found`);
      }
      throw new InternalServerErrorException(`Failed to list tables: ${errorMessage}`);
    }
  }

  /**
   * Describe a table in Snowflake
   */
  async describeTable(dataSourceId: number, database: string, schema: string, table: string) {
    try {
      const structure = await this.legacyService.describeTable(dataSourceId, database, schema, table);
      return { structure };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error describing Snowflake table: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Table ${table} not found in ${database}.${schema}`);
      }
      throw new InternalServerErrorException(`Failed to describe table: ${errorMessage}`);
    }
  }

  /**
   * Execute a query against Snowflake
   */
  async executeQuery(dataSourceId: number, query: string) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }

    try {
      return await this.legacyService.executeQuery(dataSourceId, query);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing Snowflake query: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Data source with ID ${dataSourceId} not found`);
      }
      throw new InternalServerErrorException(`Failed to execute query: ${errorMessage}`);
    }
  }

  /**
   * Execute a natural language query against Snowflake
   */
  async executeNaturalLanguageQuery(dataSourceId: number, query: string, options: any = {}) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }

    if (!this.nlQueryService) {
      throw new InternalServerErrorException('Natural language query service is not available');
    }

    try {
      return await this.nlQueryService.executeNaturalLanguageQuery(dataSourceId, query, options);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing natural language query: ${errorMessage}`, 'SnowflakeService');
      if (typeof errorMessage === 'string' && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        throw new NotFoundException(`Data source with ID ${dataSourceId} not found`);
      }
      throw new InternalServerErrorException(`Failed to execute natural language query: ${errorMessage}`);
    }
  }

  // Helper methods
  private validateConnectionParams(params: SnowflakeConnectionParams) {
    if (!params.account || !params.username || !params.password) {
      throw new BadRequestException('Account, username, and password are required for Snowflake connection');
    }
  }
} 