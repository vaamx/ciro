import { createServiceLogger } from '../utils/logger-factory';
import { Request, Response } from '../types';
import { SnowflakeService } from '../services/data-processing/snowflake/snowflake.service';
import { SnowflakeNLQueryService } from '../services/data-processing/snowflake/snowflake-nl-query.service';
import { BadRequestError } from '../utils/errors';

export class SnowflakeController {
  private snowflakeService: SnowflakeService;
  private snowflakeNLQueryService: SnowflakeNLQueryService;
  private logger = createServiceLogger('SnowflakeController');

  constructor(private readonly snowflakeNLQueryService: SnowflakeNLQueryService, private readonly snowflakeService: SnowflakeService) {
    this.snowflakeService = this.snowflakeService;
    this.snowflakeNLQueryService = this.snowflakeNLQueryService;
  }

  /**
   * Test a connection to Snowflake
   */
  public testConnection = async (req: Request, res: Response) => {
    try {
      const { 
        account, 
        username, 
        password, 
        database, 
        schema, 
        warehouse, 
        role 
      } = req.body;

      // Validate required parameters
      if (!account || !username || !password) {
        throw new BadRequestError('Account, username, and password are required for Snowflake connection');
      }

      // Create a temporary connection for testing (not associated with a data source yet)
      const connectionResult = await this.snowflakeService.createConnection(
        0, // Temporary ID, won't be stored
        { account, username, password, database, schema, warehouse, role }
      );

      if (connectionResult.success) {
        // Close the connection since it was just for testing
        await this.snowflakeService.closeConnection(0);
      }

      return res.status(200).json(connectionResult);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error testing Snowflake connection: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * List available databases in a Snowflake data source
   */
  public listDatabases = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const databases = await this.snowflakeService.listDatabases(parseInt(id));
      return res.status(200).json({ databases });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error listing Snowflake databases: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * List available schemas in a Snowflake database
   */
  public listSchemas = async (req: Request, res: Response) => {
    try {
      const { id, database } = req.params;
      const schemas = await this.snowflakeService.listSchemas(parseInt(id), database);
      return res.status(200).json({ schemas });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error listing Snowflake schemas: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * List available tables in a Snowflake schema
   */
  public listTables = async (req: Request, res: Response) => {
    try {
      const { id, database, schema } = req.params;
      const tables = await this.snowflakeService.listTables(parseInt(id), database, schema);
      return res.status(200).json({ tables });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error listing Snowflake tables: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * Describe a table in Snowflake
   */
  public describeTable = async (req: Request, res: Response) => {
    try {
      const { id, database, schema, table } = req.params;
      const structure = await this.snowflakeService.describeTable(
        parseInt(id),
        database,
        schema,
        table
      );
      return res.status(200).json({ structure });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error describing Snowflake table: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * Execute a query against Snowflake
   */
  public executeQuery = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { query } = req.body;

      if (!query) {
        throw new BadRequestError('Query is required');
      }

      const results = await this.snowflakeService.executeQuery(parseInt(id), query);
      return res.status(200).json(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error executing Snowflake query: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }

  /**
   * Execute a natural language query against Snowflake
   */
  public executeNaturalLanguageQuery = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { query, options } = req.body;

      if (!query) {
        throw new BadRequestError('Query is required');
      }

      const results = await this.snowflakeNLQueryService.executeNaturalLanguageQuery(
        parseInt(id),
        query,
        options || {}
      );
      
      return res.status(200).json(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error executing natural language query: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }
  
  /**
   * Create embeddings for Snowflake tables to enable semantic search
   */
  public createTableEmbeddings = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { tables } = req.body;
      
      const results = await this.snowflakeNLQueryService.createEmbeddingsForTables(
        parseInt(id),
        tables
      );
      
      return res.status(200).json({
        success: true,
        results
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error creating table embeddings: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }
  
  /**
   * Find tables relevant to a natural language query using semantic search
   */
  public findRelevantTables = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { query, limit } = req.body;
      
      if (!query) {
        throw new BadRequestError('Query is required');
      }
      
      const results = await this.snowflakeNLQueryService.findRelevantTables(
        parseInt(id),
        query,
        limit
      );
      
      return res.status(200).json(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error finding relevant tables: ${errorMessage}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage 
      });
    }
  }
} 