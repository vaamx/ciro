import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
let connection;

if (databaseUrl) {
  // Parse connection string if provided
  connection = databaseUrl;
} else {
  // Use individual connection parameters
  connection = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_NAME || 'ciro_db',
  };
}

// Base configuration
const baseConfig = {
  client: 'pg',
  connection,
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: path.join(__dirname, '../../../migrations'),
    loadExtensions: ['.js', '.ts'],
    tableName: 'knex_migrations',
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, '../../../seeds'),
    loadExtensions: ['.js', '.ts'],
    extension: 'ts',
  }
};

// Environment-specific configurations
const config = {
  development: {
    ...baseConfig,
    debug: process.env.DB_DEBUG === 'true'
  },
  test: {
    ...baseConfig,
    connection: {
      ...connection,
      database: `${typeof connection === 'string' ? connection : connection.database}_test`
    },
  },
  production: {
    ...baseConfig,
    pool: {
      min: 5,
      max: 30
    },
    debug: false
  }
};

// Export config for the current environment
const environment = process.env.NODE_ENV || 'development';
export default config[environment] || config.development; 