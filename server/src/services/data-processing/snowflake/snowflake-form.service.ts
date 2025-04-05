import * as snowflake from 'snowflake-sdk';

// Interface for Snowflake connection options
interface SnowflakeConnectionOptions {
  account: string;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPass?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
}

// Generic interface for query results
interface QueryResult {
  [key: string]: any
}

/**
 * Service for interacting with Snowflake using form-based authentication
 */
export class SnowflakeFormService {
  /**
   * Test a connection to Snowflake
   */
  async testConnection(options: SnowflakeConnectionOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const connectionConfig: any = {
        account: options.account,
        username: options.username,
      };
      
      // Add authentication parameters
      if (options.password) {
        connectionConfig.password = options.password;
      } else if (options.privateKey) {
        connectionConfig.authenticator = 'SNOWFLAKE_JWT';
        connectionConfig.privateKey = options.privateKey;
        if (options.privateKeyPass) {
          connectionConfig.privateKeyPass = options.privateKeyPass;
        }
      } else {
        return reject(new Error('Either password or private key must be provided'));
      }
      
      // Add optional parameters if provided
      if (options.warehouse) connectionConfig.warehouse = options.warehouse;
      if (options.database) connectionConfig.database = options.database;
      if (options.schema) connectionConfig.schema = options.schema;
      if (options.role) connectionConfig.role = options.role;
      
      // Handle AZURE accounts - they require special parameters
      if (options.account.toLowerCase().includes('azure')) {
        console.log('Azure Snowflake account detected, disabling certificate validation');
        connectionConfig.validateDefaultParameters = false;
        connectionConfig.insecureConnect = true;
      }
      
      console.log(`Testing connection to ${options.account} as ${options.username}`);
      
      // Create the connection
      const connection = snowflake.createConnection(connectionConfig);
      
      // Connect to Snowflake
      connection.connect((err, conn) => {
        if (err) {
          console.error('Error connecting to Snowflake:', err);
          return reject(err);
        }
        
        // Execute a simple query to verify the connection
        conn.execute({
          sqlText: 'SELECT current_version(), current_role(), current_warehouse(), current_database(), current_schema()',
          complete: (err, stmt, rows) => {
            if (err) {
              connection.destroy((destroyErr) => {
                if (destroyErr) {
                  console.error('Error destroying connection:', destroyErr);
                }
                return reject(err);
              });
              return;
            }
            
            // Get the current session details
            const version = rows?.[0]?.["CURRENT_VERSION()"] || 'Unknown';
            const currentRole = rows?.[0]?.["CURRENT_ROLE()"] || 'None';
            const currentWarehouse = rows?.[0]?.["CURRENT_WAREHOUSE()"] || 'None';
            const currentDatabase = rows?.[0]?.["CURRENT_DATABASE()"] || 'None';
            const currentSchema = rows?.[0]?.["CURRENT_SCHEMA()"] || 'None';
            
            console.log(`Connected to Snowflake version ${version}`);
            console.log(`Current role: ${currentRole}`);
            console.log(`Current warehouse: ${currentWarehouse}`);
            console.log(`Current database: ${currentDatabase}`);
            console.log(`Current schema: ${currentSchema}`);
            
            // Also try to list warehouses to verify we can access them
            conn.execute({
              sqlText: 'SHOW WAREHOUSES',
              complete: (warehouseErr, warehouseStmt, warehouseRows) => {
                if (warehouseErr) {
                  console.error('Error listing warehouses:', warehouseErr);
                }
                
                const warehouseCount = warehouseRows?.length || 0;
                console.log(`Found ${warehouseCount} warehouses`);
                
                // Always destroy the connection when done
                connection.destroy((destroyErr) => {
                  if (destroyErr) {
                    console.error('Error destroying connection:', destroyErr);
                  }
                  
                  resolve({
                    connected: true,
                    version,
                    account: options.account,
                    user: options.username,
                    role: currentRole,
                    warehouse: currentWarehouse,
                    database: currentDatabase,
                    schema: currentSchema,
                    warehouseCount
                  });
                });
              }
            });
          }
        });
      });
    });
  }
  
  /**
   * Execute a query with the given connection parameters
   */
  private async executeQuery(
    connectionParams: SnowflakeConnectionOptions, 
    sqlText: string
  ): Promise<QueryResult[]> {
    console.log(`Executing query: ${sqlText}`);
    
    // Create a connection with the given parameters
    let connection;
    try {
      connection = await this.createConnection(connectionParams);
    } catch (error) {
      console.error('Failed to create connection for query execution:', error);
      throw error;
    }
    
    try {
      return await new Promise<QueryResult[]>((resolve, reject) => {
        connection.execute({
          sqlText,
          complete: (err, stmt, rows) => {
            if (err) {
              console.error(`Error executing query "${sqlText}":`, err);
              return reject(err);
            }
            
            if (!rows || rows.length === 0) {
              console.log(`Query returned no rows: ${sqlText}`);
              resolve([]);
              return;
            }
            
            console.log(`Query returned ${rows.length} rows`);
            // For debugging, log the first row
            if (rows.length > 0) {
              console.log('Sample row:', JSON.stringify(rows[0]));
            }
            
            resolve(rows || []);
          }
        });
      });
    } finally {
      if (connection) {
        try {
          await this.closeConnection(connection);
        } catch (error) {
          console.error('Error closing connection:', error);
        }
      }
    }
  }
  
  /**
   * Create a connection to Snowflake
   */
  private async createConnection(
    options: SnowflakeConnectionOptions
  ): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      const connectionConfig: any = {
        account: options.account,
        username: options.username,
      };
      
      // Add authentication parameters
      if (options.password) {
        connectionConfig.password = options.password;
      } else if (options.privateKey) {
        connectionConfig.authenticator = 'SNOWFLAKE_JWT';
        connectionConfig.privateKey = options.privateKey;
        if (options.privateKeyPass) {
          connectionConfig.privateKeyPass = options.privateKeyPass;
        }
      } else {
        return reject(new Error('Either password or private key must be provided'));
      }
      
      // Add optional parameters if provided
      if (options.warehouse) connectionConfig.warehouse = options.warehouse;
      if (options.database) connectionConfig.database = options.database;
      if (options.schema) connectionConfig.schema = options.schema;
      if (options.role) connectionConfig.role = options.role;
      
      // Special handling for Azure accounts
      if (options.account.toLowerCase().includes('azure')) {
        console.log('Azure Snowflake account detected, disabling certificate validation');
        // Disable certificate validation for Azure accounts
        connectionConfig.validateDefaultParameters = false;
        connectionConfig.insecureConnect = true;
      }
      
      // Create the connection
      const connection = snowflake.createConnection(connectionConfig);
      
      // Connect to Snowflake
      connection.connect((err, conn) => {
        if (err) {
          console.error('Error connecting to Snowflake:', err);
          return reject(err);
        }
        
        resolve(conn);
      });
    });
  }
  
  /**
   * Close a Snowflake connection
   */
  private async closeConnection(connection: snowflake.Connection): Promise<void> {
    return new Promise((resolve) => {
      connection.destroy((err) => {
        if (err) {
          console.error('Error destroying connection:', err);
        }
        resolve();
      });
    });
  }
  
  /**
   * List available warehouses
   */
  async listWarehouses(connectionParams: SnowflakeConnectionOptions): Promise<any[]> {
    try {
      console.log('Listing warehouses with role:', connectionParams.role);
      
      // If a role is specified, set it first in a separate query
      if (connectionParams.role) {
        await this.executeQuery(
          connectionParams,
          `USE ROLE "${connectionParams.role}"`
        );
      }
      
      // Then execute the SHOW WAREHOUSES command separately
      const results = await this.executeQuery(
        connectionParams,
        `SHOW WAREHOUSES`
      );
      
      console.log(`Found ${results.length} warehouses`);
      return results.map((row) => ({
        name: row.name,
        state: row.state,
        type: row.type,
        size: row.size
      }));
    } catch (error) {
      console.error('Error listing warehouses:', error);
      throw error;
    }
  }
  
  /**
   * List available databases
   */
  async listDatabases(connectionParams: SnowflakeConnectionOptions): Promise<any[]> {
    try {
      console.log('Listing databases with role:', connectionParams.role);
      
      // If a role is specified, set it first in a separate query
      if (connectionParams.role) {
        await this.executeQuery(
          connectionParams,
          `USE ROLE "${connectionParams.role}"`
        );
      }
      
      // Then execute the SHOW DATABASES command separately
      const results = await this.executeQuery(
        connectionParams,
        `SHOW DATABASES`
      );
      
      console.log(`Found ${results.length} databases`);
      return results.map((row) => ({
        name: row.name,
        created_on: row.created_on,
        owner: row.owner
      }));
    } catch (error) {
      console.error('Error listing databases:', error);
      throw error;
    }
  }
  
  /**
   * List schemas in a database
   */
  async listSchemas(
    connectionParams: SnowflakeConnectionOptions, 
    database: string
  ): Promise<any[]> {
    try {
      console.log(`Listing schemas in database: ${database} with role: ${connectionParams.role}`);
      
      // If a role is specified, set it first in a separate query
      if (connectionParams.role) {
        await this.executeQuery(
          connectionParams,
          `USE ROLE "${connectionParams.role}"`
        );
      }
      
      // Execute SHOW SCHEMAS with explicit database filter
      const results = await this.executeQuery(
        connectionParams,
        `SHOW SCHEMAS IN DATABASE "${database}"`
      );
      
      console.log(`Found ${results.length} schemas in database ${database}`);
      
      // Create a map to deduplicate schemas by name
      const schemaMap = new Map();
      
      // Process results and ensure no duplicates
      results.forEach(row => {
        // Only add if this schema name hasn't been seen yet or if it belongs to our database
        if (!schemaMap.has(row.name) || (row.database_name === database)) {
          schemaMap.set(row.name, {
            name: row.name,
            database: database,
            owner: row.owner
          });
        }
      });
      
      // Convert map values to array
      return Array.from(schemaMap.values());
    } catch (error) {
      console.error(`Error listing schemas in database ${database}:`, error);
      throw error;
    }
  }
  
  /**
   * List tables in a schema
   */
  async listTables(
    connectionParams: SnowflakeConnectionOptions, 
    database: string, 
    schema: string
  ): Promise<any[]> {
    try {
      console.log(`Listing tables in ${database}.${schema} with role: ${connectionParams.role}`);
      
      // If a role is specified, set it first in a separate query
      if (connectionParams.role) {
        await this.executeQuery(
          connectionParams,
          `USE ROLE "${connectionParams.role}"`
        );
      }
      
      // Set the database context
      await this.executeQuery(
        connectionParams,
        `USE DATABASE "${database}"`
      );
      
      // Set the schema context
      await this.executeQuery(
        connectionParams,
        `USE SCHEMA "${schema}"`
      );
      
      // Execute the SHOW TABLES command
      const results = await this.executeQuery(
        connectionParams,
        `SHOW TABLES`
      );
      
      console.log(`Found ${results.length} tables in ${database}.${schema}`);
      return results.map((row) => ({
        name: row.name,
        database: row.database_name || database,
        schema: row.schema_name || schema,
        kind: row.kind,
        created_on: row.created_on
      }));
    } catch (error) {
      console.error(`Error listing tables in ${database}.${schema}:`, error);
      throw error;
    }
  }
  
  /**
   * List available roles
   */
  async listRoles(connectionParams: SnowflakeConnectionOptions): Promise<any[]> {
    try {
      console.log('Listing roles');
      const results = await this.executeQuery(
        connectionParams,
        'SHOW ROLES'
      );
      
      console.log(`Found ${results.length} roles`);
      return results.map((row) => ({
        name: row.name,
        owner: row.owner,
        is_default: row.is_default === 'Y',
        is_current: row.is_current === 'Y'
      }));
    } catch (error) {
      console.error('Error listing roles:', error);
      throw error;
    }
  }
} 