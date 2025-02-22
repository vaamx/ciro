import { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

type Environment = 'development' | 'test' | 'production';

const configurations: Record<Environment, Knex.Config> = {
  development: {
    client: '***REMOVED***ql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
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
      directory: path.join(__dirname, '../../migrations')
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

export default configurations; 