import * as moment from 'moment';
import { QueryBuilder } from 'knex';
import { knex } from '../config/database';

export interface TripStop {
  stop_id: string;
  stop_sequence: number;
}

/**
 * Get stops for trip
 * @param {*} regionName
 * @param {*} tripId
 */
export async function getTripStops(regionName: string, tripId: string): Promise<TripStop[]> {
  const stopTimesTable = `${regionName}_stop_times`;

  return knex(stopTimesTable)
    .select(`${stopTimesTable}.stop_id`, `${stopTimesTable}.stop_sequence`)
    .where(`${stopTimesTable}.trip_id`, tripId);
}
