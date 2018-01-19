import * as moment from 'moment';
import * as lodash from 'lodash';
import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { TripUpdateDB, updateDatabase } from '../lib/databaseUpdater';
import { StopTimeUpdateDB } from '../lib/databaseUpdater';

interface FeedMessage {
  header: FeedHeader;
  entity?: FeedEntity[];
}

interface FeedHeader {
  gtfs_realtime_version: string;
  incrementality: number; // Enum
  timestamp: Timestamp;
}

interface Timestamp {
  low: number;
  high: number;
  unsigned: boolean;
}

interface FeedEntity {
  id: string;
  is_deleted?: boolean;
  trip_update?: TripUpdate;
}

interface TripUpdate {
  trip: TripDescriptor;
  vehicle?: VehicleDescriptor;
  stop_time_update?: StopTimeUpdate[];
  timestamp?: Timestamp;
  delay?: number;
}

interface TripDescriptor {
  trip_id?: string;
  route_id?: string;
  direction_id?: number;
  start_time?: string;
  start_date?: string;
  schedule_relationship?: number; // Enum
}

interface VehicleDescriptor {
  id?: string;
  label?: string;
  license_plate?: string;
}

interface StopTimeUpdate {
  stop_sequence?: number;
  stop_id?: string;
  arrival?: StopTimeEvent;
  departure?: StopTimeEvent;
  schedule_relationship?: number; // Enum
}

interface StopTimeEvent {
  delay?: number;
  time?: Timestamp;
  uncertainty?: number;
}

/**
 * Store trip update feed to database
 * @param region
 * @param feedBinary
 */
export async function storeTripUpdateFeed(regionName: string, feedBinary: any) {
  const feedData: FeedMessage = GtfsRealtimeBindings.FeedMessage.decode(feedBinary);

  const feedTimestampString = moment
    .unix(feedData.header.timestamp.low)
    .format('YYYY-MM-DD HH:mm:ss');

  const tripUpdates: TripUpdateDB[] = [];
  const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];

  // Process feed entities
  for (const entity of feedData.entity) {
    const tripUpdate = createTripUpdate(entity, feedTimestampString);
    tripUpdates.push(tripUpdate);

    tripUpdateStopTimeUpdates.push(
      ...entity.trip_update.stop_time_update.map(stopTimeUpdate => {
        return createStopTimeUpdate(stopTimeUpdate, tripUpdate.trip_update_id);
      }),
    );
  }

  await updateDatabase(regionName, tripUpdates, tripUpdateStopTimeUpdates);
  return tripUpdates.length;
}

/**
 * Create trip update object
 * @param {*} entity
 * @param {*} recorded
 */
function createTripUpdate(entity: FeedEntity, recorded: string): TripUpdateDB {
  const tripUpdate = entity.trip_update;
  return {
    trip_update_id: entity.id,
    trip_id: tripUpdate.trip.trip_id,
    route_id: tripUpdate.trip.route_id,
    direction_id: tripUpdate.trip.direction_id,
    trip_start_time: tripUpdate.trip.start_time,
    trip_start_date: tripUpdate.trip.start_date,
    schedule_relationship: tripUpdate.trip.schedule_relationship,
    vehicle_id: lodash.get(tripUpdate, 'vehicle.id', null),
    vehicle_label: lodash.get(tripUpdate, 'vehicle.label', null),
    vehicle_license_plate: lodash.get(tripUpdate, 'vehicle.license_plate', null),
    recorded,
  };
}

/**
 * Create trip update stop time update object
 * @param {*} stopTimeUpdate
 * @param {*} tripUpdateId
 */
function createStopTimeUpdate(stopTimeUpdateData: any, tripUpdateId: string): StopTimeUpdateDB {
  return {
    stop_sequence: stopTimeUpdateData.stop_sequence,
    stop_id: stopTimeUpdateData.stop_id,
    arrival_delay: lodash.get(stopTimeUpdateData, 'arrival.delay', null),
    arrival_time: lodash.get(stopTimeUpdateData, 'arrival.time.low', null),
    arrival_uncertainty: lodash.get(stopTimeUpdateData, 'arrival.uncertainty', null),
    departure_delay: lodash.get(stopTimeUpdateData, 'departure.delay', null),
    departure_time: lodash.get(stopTimeUpdateData, 'departure.time.low', null),
    departure_uncertainty: lodash.get(stopTimeUpdateData, 'departure.uncertainty', null),
    schedule_relationship: stopTimeUpdateData.schedule_relationship,
    trip_update_id: tripUpdateId,
  };
}
