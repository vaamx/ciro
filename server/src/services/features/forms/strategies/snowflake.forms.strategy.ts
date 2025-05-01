import { Injectable, Logger } from '@nestjs/common';
import * as snowflake from 'snowflake-sdk';
import { IFormsStrategy, FormSchema, ConnectionTestResult, FormField } from '../forms.strategy.interface';

// Re-define or import the SnowflakeConnectionOptions if not globally available
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

@Injectable()
export class SnowflakeFormsStrategy implements IFormsStrategy {
  private readonly logger = new Logger(SnowflakeFormsStrategy.name);

  // This strategy might need ConfigService or other dependencies in a real scenario
  constructor() {}

  async getFormSchema(): Promise<FormSchema> {
    // Define the fields required for a Snowflake connection
    const fields: FormField[] = [
      { name: 'account', label: 'Account Identifier', type: 'text', required: true, placeholder: 'e.g., xy12345.us-east-1' },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: false }, // Required only if private key is not used
      // Add fields for private key authentication if needed
      // { name: 'privateKey', label: 'Private Key', type: 'textarea', required: false },
      // { name: 'privateKeyPass', label: 'Private Key Passphrase', type: 'password', required: false },
      { name: 'warehouse', label: 'Warehouse (Optional)', type: 'text', required: false },
      { name: 'database', label: 'Database (Optional)', type: 'text', required: false },
      { name: 'schema', label: 'Schema (Optional)', type: 'text', required: false },
      { name: 'role', label: 'Role (Optional)', type: 'text', required: false },
    ];
    return { fields };
  }

  async testConnection(credentials: Record<string, any>): Promise<ConnectionTestResult> {
    // Type cast or validate credentials
    const options = credentials as SnowflakeConnectionOptions;
    
    // --- Logic moved from SnowflakeFormService --- 
    return new Promise((resolve) => { // Removed reject as we resolve with success/fail object
      const connectionConfig: any = {
        account: options.account,
        username: options.username,
      };
      
      if (options.password) {
        connectionConfig.password = options.password;
      } else {
         // Simplified: Assume password is required for this basic example
         // In reality, add private key logic here if needed
        return resolve({ success: false, message: 'Password is required for testing.' });
      }
      
      if (options.warehouse) connectionConfig.warehouse = options.warehouse;
      if (options.database) connectionConfig.database = options.database;
      if (options.schema) connectionConfig.schema = options.schema;
      if (options.role) connectionConfig.role = options.role;
      
      if (options.account?.toLowerCase().includes('azure')) {
        this.logger.debug('Azure Snowflake account detected, adjusting connection params');
        connectionConfig.validateDefaultParameters = false;
        connectionConfig.insecureConnect = true;
      }
      
      this.logger.log(`Testing connection to ${options.account} as ${options.username}`);
      const connection = snowflake.createConnection(connectionConfig);
      
      connection.connect((err, conn) => {
        if (err) {
          this.logger.error('Error connecting to Snowflake:', err);
          return resolve({ success: false, message: err.message });
        }
        
        conn.execute({
          sqlText: 'SELECT current_version(), current_role(), current_warehouse()',
          complete: (execErr, stmt, rows) => {
             connection.destroy((destroyErr) => { // Ensure connection is destroyed
                if (destroyErr) {
                    this.logger.warn('Error destroying test connection:', destroyErr);
                }
                
                if (execErr) {
                  this.logger.error('Error executing test query:', execErr);
                  return resolve({ success: false, message: `Query failed: ${execErr.message}` });
                }

                const details = {
                    version: rows?.[0]?.["CURRENT_VERSION()"] || 'Unknown',
                    role: rows?.[0]?.["CURRENT_ROLE()"] || 'Unknown',
                    warehouse: rows?.[0]?.["CURRENT_WAREHOUSE()"] || 'Unknown',
                };
                this.logger.log(`Snowflake connection test successful: ${JSON.stringify(details)}`);
                resolve({ success: true, message: 'Connection successful', details });
             });
          }
        });
      });
    });
     // --- End of moved logic --- 
  }

  // --- Implement optional methods using moved logic --- 

  async listWarehouses(credentials: Record<string, any>): Promise<string[]> {
    this.logger.debug(`Listing warehouses for account: ${credentials.account}`);
    const results = await this.executeQuery(credentials as SnowflakeConnectionOptions, 'SHOW WAREHOUSES');
    // Assuming the warehouse name is in a column named 'name'
    return results.map(row => row['name']).filter(Boolean) as string[];
  }

  async listDatabases(credentials: Record<string, any>): Promise<string[]> {
     this.logger.debug(`Listing databases for account: ${credentials.account}`);
     const results = await this.executeQuery(credentials as SnowflakeConnectionOptions, 'SHOW DATABASES');
     return results.map(row => row['name']).filter(Boolean) as string[];
  }

  async listSchemas(credentials: Record<string, any>, database: string): Promise<string[]> {
     this.logger.debug(`Listing schemas in database '${database}' for account: ${credentials.account}`);
     // Important: Sanitize database name if necessary before injecting into SQL
     const results = await this.executeQuery(credentials as SnowflakeConnectionOptions, `SHOW SCHEMAS IN DATABASE "${database}"`);
     return results.map(row => row['name']).filter(Boolean) as string[];
  }
  
  async listTables(credentials: Record<string, any>, database: string, schema: string): Promise<string[]> {
    this.logger.debug(`Listing tables in schema '${database}.${schema}' for account: ${credentials.account}`);
    const results = await this.executeQuery(credentials as SnowflakeConnectionOptions, `SHOW TABLES IN SCHEMA "${database}"."${schema}"`);
    // Assuming table name is in a column named 'name'
    return results.map(row => row['name']).filter(Boolean) as string[];
  }
  
  async listRoles(credentials: Record<string, any>): Promise<string[]> {
    this.logger.debug(`Listing roles for account: ${credentials.account}`);
    const results = await this.executeQuery(credentials as SnowflakeConnectionOptions, 'SHOW ROLES');
    return results.map(row => row['name']).filter(Boolean) as string[];
  }

  // --- Helper methods moved from SnowflakeFormService --- 

  private async executeQuery(
    connectionParams: SnowflakeConnectionOptions, 
    sqlText: string
  ): Promise<Record<string, any>[]> { // Changed return type for easier mapping
    this.logger.debug(`Executing query via strategy: ${sqlText.substring(0, 50)}...`);
    let connection: snowflake.Connection | undefined = undefined;
    try {
      connection = await this.createConnection(connectionParams);
      return await new Promise<Record<string, any>[]>((resolve, reject) => {
        connection!.execute({
          sqlText,
          complete: (err, stmt, rows) => {
            if (err) {
              this.logger.error(`Error executing query "${sqlText}":`, err);
              return reject(err);
            }
            resolve(rows || []);
          }
        });
      });
    } finally {
      if (connection) {
        await this.closeConnection(connection);
      }
    }
  }

  private async createConnection(
    options: SnowflakeConnectionOptions
  ): Promise<snowflake.Connection> {
     // --- Simplified connection logic from SnowflakeFormService --- 
     return new Promise((resolve, reject) => {
      const connectionConfig: any = {
        account: options.account,
        username: options.username,
      };
      if (options.password) {
        connectionConfig.password = options.password;
      } else {
         return reject(new Error('Password is required for connection.'));
      }
      if (options.warehouse) connectionConfig.warehouse = options.warehouse;
      if (options.database) connectionConfig.database = options.database;
      if (options.schema) connectionConfig.schema = options.schema;
      if (options.role) connectionConfig.role = options.role;
      if (options.account?.toLowerCase().includes('azure')) {
        connectionConfig.validateDefaultParameters = false;
        connectionConfig.insecureConnect = true;
      }
      const connection = snowflake.createConnection(connectionConfig);
      connection.connect((err) => {
        if (err) {
          return reject(err);
        }
        resolve(connection);
      });
    });
  }

  private async closeConnection(connection: snowflake.Connection): Promise<void> {
    // --- Simplified close logic from SnowflakeFormService --- 
    return new Promise((resolve, reject) => {
      connection.destroy((err) => {
        if (err) {
          this.logger.warn('Error destroying Snowflake connection:', err);
          // Don't reject, just log and resolve
        }
        resolve();
      });
    });
  }
} 