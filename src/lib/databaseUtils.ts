import { knex } from '../config/database';
import Knex from 'knex';

/**
 * Insert or update data
 * @param tableName
 * @param data
 *
export async function insertOrUpdate(tableName: string, data: object[]) {
  if (data.length < 1) {
    return;
  }

  const firstData = data[0] ? data[0] : data;
  return knex.raw(
    knex(tableName).insert(data).toQuery() +
      ' ON DUPLICATE KEY UPDATE ' +
      Object.getOwnPropertyNames(firstData)
        .map((field) => `${field}=VALUES(${field})`)
        .join(', '),
  );
}
*/

export async function insertOrUpdate(
  knexTransaction: Knex.Transaction,
  tableName: string,
  data: object[],
) {
  const firstData = data[0] ? data[0] : data;
  return knexTransaction.raw(
    knexTransaction(tableName).insert(data).toQuery() +
      ' ON DUPLICATE KEY UPDATE ' +
      Object.getOwnPropertyNames(firstData)
        .map((field) => `${field}=VALUES(${field})`)
        .join(', '),
  );
}

/**
 * Empty table, delete all rows
 * @param tableName
 */
export async function emptyTable(tableName: string) {
  return knex(tableName).del();
}
