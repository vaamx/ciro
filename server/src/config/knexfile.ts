/**
 * This file is a re-export of the configuration from src/config/knexfile.ts
 * It exists for backward compatibility and to support tools that expect a knexfile at the root level.
 * 
 * The actual configuration is maintained in src/config/knexfile.ts
 */
import { Knex } from 'knex';
import { config } from '../config';
import path from 'path';

// Base knex configuration derived from the centralized config
const baseConfig: Knex.Config = {
  client: '***REMOVED***ql',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: path.join(__dirname, '../../migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, '../../seeds'),
    extension: 'ts',
  }
};

// Environment-specific configurations
const configurations = {
  development: {
    ...baseConfig,
    debug: process.env.DB_DEBUG === 'true'
  },

  test: {
    ...baseConfig,
    connection: {
      ...baseConfig.connection as object,
      database: `${config.database.database}_test`
    }
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

export default configurations; 