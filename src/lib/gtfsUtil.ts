import moment from 'moment';
import { QueryBuilder } from 'knex';
import { knex } from '../config/database';

export interface Trip {
  trip_id: string;
  route_id: string;
  direction_id: number;
}

export interface TripStop {
  stop_id: string;
  stop_sequence: number;
}

export interface StopTime {
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
}

interface Route {
  route_short_name: string;
  route_id: string;
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

/**
 * Get trip by trip id
 * @param regionName
 * @param tripId
 */
export async function getTripById(regionName: string, tripId: string): Promise<Trip> {
  const tripsTable = `${regionName}_trips`;
  return knex(tripsTable)
    .select('route_id', 'trip_id', 'direction_id')
    .where('trip_id', tripId)
    .first();
}

/**
 * Try get trip id from database
 * @param regionName
 * @param routeId
 * @param originDeparture
 * @param direction
 * @param activeServices
 */
export async function getTripId(
  regionName: string,
  routeId: string,
  originDeparture: Date,
  direction: number,
  activeServices: string[],
): Promise<string | undefined> {
  const tripsTable = `${regionName}_trips`;
  const routesTable = `${regionName}_routes`;
  const stopTimesTable = `${regionName}_stop_times`;

  const trip = await knex(tripsTable)
    .select(`${tripsTable}.trip_id`, `${stopTimesTable}.stop_sequence`)
    .innerJoin(routesTable, `${routesTable}.route_id`, `${tripsTable}.route_id`)
    .innerJoin(stopTimesTable, `${stopTimesTable}.trip_id`, `${tripsTable}.trip_id`)
    .whereIn(`${tripsTable}.service_id`, activeServices)
    .andWhere(`${routesTable}.route_id`, routeId)
    .andWhere(
      `${stopTimesTable}.departure_time`,
      'like',
      moment(originDeparture).format('HH:mm') + '%',
    ) // Do not try to mach seconds, as vehicle api might return only minutes (case Tampere siri api)
    .andWhere(`${tripsTable}.direction_id`, direction)
    .orderBy(`${stopTimesTable}.stop_sequence`)
    .first();

  return trip ? trip.trip_id : undefined;
}

/**
 * Get day active services
 * @param regionName
 * @param date
 */
export async function getActiveServiceIds(regionName: string, date: Date): Promise<string[]> {
  const calendarTable = `${regionName}_calendar`;
  const calendarDatesTable = `${regionName}_calendar_dates`;
  const calendarDatesColumn = getGtfsCalendarDayColumnName(date);
  const formattedDate = moment(date).format('YYYYMMDD');

  const services = await knex(calendarTable)
    .select('service_id')
    .where('start_date', '<=', formattedDate)
    .andWhere('end_date', '>=', formattedDate)
    .andWhere(calendarDatesColumn, 1)
    .whereNotIn('service_id', (qb: QueryBuilder) => {
      qb.select('service_id')
        .from(calendarDatesTable)
        .where('date', formattedDate)
        .andWhere('exception_type', '2');
    })
    .union((qb: QueryBuilder) => {
      qb.select('service_id')
        .from(calendarDatesTable)
        .where('date', formattedDate)
        .andWhere('exception_type', 1);
    });
  return services.map((service: { service_id: string }) => {
    return service.service_id;
  });
}

/**
 * Get Gtfs structure day name (table column name) for day
 * @param {Date} date - Date
 */
export function getGtfsCalendarDayColumnName(date: Date): string {
  const weekdays = new Array(7);
  weekdays[0] = 'sunday';
  weekdays[1] = 'monday';
  weekdays[2] = 'tuesday';
  weekdays[3] = 'wednesday';
  weekdays[4] = 'thursday';
  weekdays[5] = 'friday';
  weekdays[6] = 'saturday';
  return weekdays[moment(date).day()];
}

/**
 * Get route id mappings to route short name
 * @param {*} regionName
 */
export async function getRouteIdMappings(regionName: string) {
  const routesTable = `${regionName}_routes`;

  const routes = await knex(routesTable).select(
    `${routesTable}.route_id`,
    `${routesTable}.route_short_name`,
  );

  return new Map<string, string>(
    routes.map((route: Route) => {
      return [route.route_short_name, route.route_id];
    }),
  );
}

/**
 * Get trip stop times
 * @param regionName
 * @param tripId
 */
export async function getTripStopTimes(regionName: string, tripId: string): Promise<StopTime[]> {
  const stopTimesTable = `${regionName}_stop_times`;
  return knex(stopTimesTable)
    .select('arrival_time', 'departure_time', 'stop_id', 'stop_sequence')
    .where('trip_id', tripId)
    .orderBy('stop_sequence');
}
