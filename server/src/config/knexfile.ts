import { Knex } from 'knex';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '.env') });

// Read environment variables for DB connection with appropriate defaults
const isInDocker = process.env.IN_DOCKER === 'true';
const defaultHost = isInDocker ? '***REMOVED***' : 'localhost';

const configurations: Record<string, Knex.Config> = {
  development: {
    client: '***REMOVED***ql',
    connection: {
      host: process.env.DB_HOST || defaultHost,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ciro_db',
      user: process.env.DB_USER || '***REMOVED***',
      password: process.env.DB_PASSWORD || '***REMOVED***',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    }
  },

  test: {
    client: '***REMOVED***ql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: `${process.env.DB_NAME || 'ciro'}_test`,
      user: process.env.DB_USER || '***REMOVED***',
      password: process.env.DB_PASSWORD || '***REMOVED***',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, '../../migrations')
    }
  },

  production: {
    client: '***REMOVED***ql',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, '../../migrations')
    }
  }
};

// Log the connection settings for easier debugging
const devConnection = configurations.development.connection as Record<string, any>;
console.log(`Knex configuration: Environment=${process.env.NODE_ENV || 'development'}, Host=${devConnection.host}, Port=${devConnection.port}, InDocker=${isInDocker}`);

// This is what knex CLI will use
module.exports = configurations;

// Export for ES modules usage
export default configurations;
export { configurations }; 