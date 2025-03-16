const knex = require('knex');
const logger = require('../utils/logger');

// Configure database connection
const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_NAME || 'ciro_db',
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 2,
    max: 10
  },
  debug: process.env.KNEX_DEBUG === 'true'
};

logger.info('Knex configuration: ' + 
  `Environment=${process.env.NODE_ENV || 'development'}, ` + 
  `Host=${config.connection.host}, ` + 
  `Port=${config.connection.port}, ` + 
  `InDocker=${process.env.IN_DOCKER === 'true'}`);

// Create the database connection
const db = knex(config);

module.exports = db;
