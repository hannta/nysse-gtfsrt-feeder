import moment from 'moment';
import { knex } from '../../../config/database';
import { insertOrUpdate } from '../../../lib/databaseUtils';
import Knex from 'knex';

const TRIP_UPDATES_TABLE = 'trip_updates';
const TRIP_UPDATE_STOP_TIME_UPDATES_TABLE = 'trip_update_stop_time_updates';
const KEEP_OLD_RECORDS_DEFAULT = 1800; // Seconds (30 min)

export interface TripUpdateDB {
  id: string;
  trip_id: string;
  route_id?: string;
  direction_id?: number;
  trip_start_time?: string;
  trip_start_date?: string;
  schedule_relationship: string;
  vehicle_id?: string;
  vehicle_label?: string;
  vehicle_license_plate?: string;
  recorded?: string;
}

export interface StopTimeUpdateDB {
  trip_update_id: string;
  stop_sequence?: number;
  stop_id?: string;
  arrival_delay?: number;
  arrival_time?: number;
  arrival_uncertainty?: number;
  departure_delay?: number;
  departure_time?: number;
  departure_uncertainty?: number;
  schedule_relationship: string;
}

/**
 * Update database with given data
 * @param regionName
 * @param tripUpdates
 * @param tripUpdateStopTimeUpdates
 */
export async function updateDatabase(
  isFullDataset: boolean,
  regionName: string,
  tripUpdates: TripUpdateDB[],
  tripUpdateStopTimeUpdates: StopTimeUpdateDB[],
  keepOldRecords?: number,
) {
  const tripUpdatesTable = `${regionName}_${TRIP_UPDATES_TABLE}`;
  const tripUpdateStopTimeUpdatesTable = `${regionName}_${TRIP_UPDATE_STOP_TIME_UPDATES_TABLE}`;

  return knex.transaction(async (trx) => {
    if (isFullDataset) {
      await trx(tripUpdatesTable).del();
    } else {
      await deleteOldData(trx, tripUpdatesTable, keepOldRecords);
    }

    if (tripUpdates && tripUpdates.length > 0) {
      await insertOrUpdate(trx, tripUpdatesTable, tripUpdates);
    }

    if (tripUpdateStopTimeUpdates && tripUpdateStopTimeUpdates.length > 0) {
      await insertOrUpdate(trx, tripUpdateStopTimeUpdatesTable, tripUpdateStopTimeUpdates);
    }
  });
}

/**
 * Delete old trip updates
 * @param tripUpdatesTable
 */
async function deleteOldData(
  knexTransaction: Knex.Transaction,
  tripUpdatesTable: string,
  keepOldRecords = KEEP_OLD_RECORDS_DEFAULT,
) {
  const olderThan = moment().subtract(keepOldRecords, 'seconds').format('YYYY-MM-DD HH:mm:ss');
  return knexTransaction(tripUpdatesTable).where('recorded', '<', olderThan).delete();
}
