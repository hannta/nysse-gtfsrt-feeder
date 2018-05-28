import * as moment from 'moment';
import * as lodash from 'lodash';
import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { TripUpdateDB, StopTimeUpdateDB, updateDatabase } from '../lib/databaseUpdater';
import { getTripStops, TripStop, getActiveServiceIds, getTripId } from '../lib/gtfsUtil';

/**
 * GTFS-RT feed processor config options
 */
export interface GtfsRTFeedProcessorSettings {
  /** If trip id is missing, try to get trip form database */
  getMissingTripFromDB?: boolean;
  /** Get trip id always from database */
  getTripAlwaysFromDB?: boolean;
  /** If stop id is missing, try to get that from database */
  tryToFixMissingStopId?: boolean;
  /** If stop sequence is missing, try to get that from database */
  tryToFixMissingStopSequence?: boolean;
  /** How old records to keep, seconds  */
  keepOldRecords?: number;
}

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
export async function storeTripUpdateFeed(
  regionName: string,
  feedBinary: any,
  settings: GtfsRTFeedProcessorSettings,
) {
  const feedData: FeedMessage = GtfsRealtimeBindings.FeedMessage.decode(feedBinary);

  if (!feedData || !feedData.entity) {
    // There should be at least empty entity(?)
    throw new Error('No feed data');
  }

  const feedTimestamp = new Date(feedData.header.timestamp.low * 1000);

  const tripUpdates: TripUpdateDB[] = [];
  const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];
  const activeServicesMap = new Map<string, string[]>();

  // Process feed entities, create trip updates
  for (const entity of feedData.entity) {
    if (!entity || !entity.trip_update || !entity.trip_update.trip) {
      // No data, skip
      continue;
    }
    const tripId =
      settings.getTripAlwaysFromDB ||
      (!entity.trip_update.trip.trip_id && settings.getMissingTripFromDB)
        ? await getTripIdFromDb(entity.trip_update, regionName, activeServicesMap)
        : entity.trip_update.trip.trip_id;

    if (!tripId) {
      // No trip id, skip this entity
      continue;
    }

    const tripUpdateId = `${tripId}-${entity.trip_update.trip.start_date || ''}-${entity.trip_update
      .trip.start_time || ''}`;

    let stopIdMissing = false;
    let stopSequenceMissing = false;

    // Create stop time updates, if exists
    if (entity.trip_update.stop_time_update) {
      tripUpdateStopTimeUpdates.push(
        ...entity.trip_update.stop_time_update.map(stopTimeUpdate => {
          const tripUpdateStopTimeUpdate = createStopTimeUpdate(tripUpdateId, stopTimeUpdate);

          // Check if any stop_id or stop_sequence is missing from this trip update stop time updates
          stopIdMissing = !tripUpdateStopTimeUpdate.stop_id ? true : stopIdMissing;
          stopSequenceMissing = !tripUpdateStopTimeUpdate.stop_sequence
            ? true
            : stopSequenceMissing;

          return tripUpdateStopTimeUpdate;
        }),
      );
    }

    // Add missing stop_id and stop_sequence values for stop time updates
    if (
      (stopIdMissing && settings.tryToFixMissingStopId) ||
      (stopSequenceMissing && settings.tryToFixMissingStopSequence)
    ) {
      const tripAllStops = await getTripStops(regionName, tripId);
      if (tripAllStops && tripAllStops.length > 0) {
        addMissingStoTimeUpdateInfos(tripUpdateStopTimeUpdates, tripAllStops, settings);
      }
    }

    tripUpdates.push(createTripUpdate(tripUpdateId, tripId, entity, feedTimestamp));
  }

  await updateDatabase(regionName, tripUpdates, tripUpdateStopTimeUpdates, settings.keepOldRecords);
  return tripUpdates.length;
}

/**
 * Try to get trip id from DB
 * @param tripUpdate
 * @param regionName
 * @param activeServicesMap
 */
async function getTripIdFromDb(
  tripUpdate: TripUpdate,
  regionName: string,
  activeServicesMap: Map<string, string[]>,
) {
  if (
    !tripUpdate.trip.start_date ||
    !tripUpdate.trip.start_time ||
    !tripUpdate.trip.route_id ||
    !tripUpdate.trip.direction_id
  ) {
    // If we do not have enough information to get trip from db, just return null to skip this
    return null;
  }

  const tripStart = moment(
    `${tripUpdate.trip.start_date} ${tripUpdate.trip.start_time}`,
    'YYYYMMDD HH:mm:ss',
  ).toDate();

  // Get active services, and cache them
  const tripStartDateString = tripUpdate.trip.start_date;
  if (!activeServicesMap.has(tripStartDateString)) {
    const activeServices = await getActiveServiceIds(regionName, tripStart);
    activeServicesMap.set(tripStartDateString, activeServices);
  }

  const activeServicesDay = activeServicesMap.get(tripStartDateString);
  if (!activeServicesDay) {
    // Unable to get active services
    return null;
  }

  const tripId = await getTripId(
    regionName,
    tripUpdate.trip.route_id,
    tripStart,
    tripUpdate.trip.direction_id,
    activeServicesDay,
  );

  return tripId;
}

/**
 * Add missing stop_id's to stop time updates
 * @param tripUpdateStopTimeUpdates
 * @param tripAllStops
 */
function addMissingStoTimeUpdateInfos(
  tripUpdateStopTimeUpdates: StopTimeUpdateDB[],
  tripAllStops: TripStop[],
  settings: GtfsRTFeedProcessorSettings,
) {
  for (const stopTimeUpdate of tripUpdateStopTimeUpdates) {
    if (settings.tryToFixMissingStopId && !stopTimeUpdate.stop_id && stopTimeUpdate.stop_sequence) {
      // Add stop_id if missing
      const stop = tripAllStops.find((tripStop: TripStop) => {
        return tripStop.stop_sequence === stopTimeUpdate.stop_sequence;
      });
      if (stop) {
        stopTimeUpdate.stop_id = stop.stop_id;
      }
    } else if (
      settings.tryToFixMissingStopSequence &&
      !stopTimeUpdate.stop_sequence &&
      stopTimeUpdate.stop_id
    ) {
      // Add stop_sequence if missing
      const stop = tripAllStops.find((tripStop: TripStop) => {
        return tripStop.stop_id === stopTimeUpdate.stop_id;
      });
      if (stop) {
        stopTimeUpdate.stop_sequence = stop.stop_sequence;
      }
    }
  }
}

/**
 * Create trip update object for db
 * @param tripUpdateId
 * @param entity
 * @param tripId
 * @param recorded
 */
function createTripUpdate(
  tripUpdateId: string,
  tripId: string,
  entity: FeedEntity,
  recorded: Date,
): TripUpdateDB {
  const tripUpdate = entity.trip_update;
  return {
    id: tripUpdateId,
    trip_id: tripId,
    route_id: tripUpdate!.trip.route_id,
    direction_id: tripUpdate!.trip.direction_id,
    trip_start_time: tripUpdate!.trip.start_time,
    trip_start_date: tripUpdate!.trip.start_date || moment().format('YYYYMMDD'), // TODO try to figure out better default
    schedule_relationship: tripUpdate!.trip.schedule_relationship,
    vehicle_id: lodash.get(tripUpdate, 'vehicle.id', undefined),
    vehicle_label: lodash.get(tripUpdate, 'vehicle.label', undefined),
    vehicle_license_plate: lodash.get(tripUpdate, 'vehicle.license_plate', undefined),
    recorded: moment(recorded).format('YYYY-MM-DD HH:mm:ss'),
  };
}

/**
 * Create trip update stop time update object for db
 * @param tripUpdateId
 * @param stopTimeUpdateData
 */
function createStopTimeUpdate(
  tripUpdateId: string,
  stopTimeUpdateData: StopTimeUpdate,
): StopTimeUpdateDB {
  return {
    trip_update_id: tripUpdateId,
    stop_sequence: stopTimeUpdateData.stop_sequence,
    stop_id: stopTimeUpdateData.stop_id,
    arrival_delay: lodash.get(stopTimeUpdateData, 'arrival.delay', null),
    arrival_time: lodash.get(stopTimeUpdateData, 'arrival.time.low', null),
    arrival_uncertainty: lodash.get(stopTimeUpdateData, 'arrival.uncertainty', null),
    departure_delay: lodash.get(stopTimeUpdateData, 'departure.delay', null),
    departure_time: lodash.get(stopTimeUpdateData, 'departure.time.low', null),
    departure_uncertainty: lodash.get(stopTimeUpdateData, 'departure.uncertainty', null),
    schedule_relationship: stopTimeUpdateData.schedule_relationship,
  };
}
