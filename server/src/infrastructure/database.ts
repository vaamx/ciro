import knex, { Knex } from 'knex';
import * as knexConfig from '../config/knexfile';

const environment = (process.env.NODE_ENV || 'development') as string;
export const db: Knex = knex(knexConfig[environment as keyof typeof knexConfig]); 