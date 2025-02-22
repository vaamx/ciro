import knex, { Knex } from 'knex';
import config from '../config/knexfile';

const environment = (process.env.NODE_ENV || 'development') as keyof typeof config;
export const db: Knex = knex(config[environment]); 