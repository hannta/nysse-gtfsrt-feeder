import * as Knex from 'knex';
import config from '../config/config';

const knexConfig: Knex.Config = {
  client: 'mariadb',
  connection: {
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    db: config.database.database,
    charset: 'utf8',
    debug: config.database.debug,
  },
  pool: {
    min: config.database.poolConnectionMin,
    max: config.database.poolConnectionMax,
  },
};

export const knex = Knex(knexConfig);
