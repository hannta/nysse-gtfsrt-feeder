import * as Knex from 'knex';
import config from '../config/config';

const knexConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    charset: 'utf8',
  },
  pool: {
    min: config.database.poolConnectionMin,
    max: config.database.poolConnectionMax,
  },
  debug: config.database.debug,
};

export const knex = Knex(knexConfig);
