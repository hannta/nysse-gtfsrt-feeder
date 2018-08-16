import moment from 'moment';
import lodash from 'lodash';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { TripUpdateDB, StopTimeUpdateDB, updateDatabase } from '../lib/databaseUpdater';
import { getActiveServiceIds, getTripId, getTripStopTimes, StopTime } from '../lib/gtfsUtil';

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

    const stopTimeUpdates = entity.trip_update.stop_time_update;
    if (!stopTimeUpdates || stopTimeUpdates.length < 1) {
      // Empty stop time update, skip this
      continue;
    }

    const tripStopTimes = await getTripStopTimes(regionName, tripId);
    if (!tripStopTimes || tripStopTimes.length < 1) {
      // Incorrect trip, no trip stop times
      continue;
    }

    const tripUpdateId = `${tripId}-${entity.trip_update.trip.start_date || ''}-${entity.trip_update
      .trip.start_time || ''}`;

    tripUpdateStopTimeUpdates.push(
      ...createStopTimeUpdates(tripUpdateId, tripStopTimes, stopTimeUpdates),
    );

    tripUpdates.push(createTripUpdate(tripUpdateId, tripId, entity, feedTimestamp));
  }

  await updateDatabase(regionName, tripUpdates, tripUpdateStopTimeUpdates, settings.keepOldRecords);
  return tripUpdates.length;
}

/**
 * Create stop time updates matching stop timetable times and gtfs-rt stop time updates
 *
 * @param tripUpdateId
 * @param tripStopTimes
 * @param stopTimeUpdates
 */
function createStopTimeUpdates(
  tripUpdateId: string,
  tripStopTimes: StopTime[],
  stopTimeUpdates: StopTimeUpdate[],
): StopTimeUpdateDB[] {
  const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];
  let delay;

  for (const stopTime of tripStopTimes) {
    const newStopTimeUpdate: StopTimeUpdateDB = {
      trip_update_id: tripUpdateId,
      stop_id: stopTime.stop_id,
      stop_sequence: stopTime.stop_sequence,
    };
    const matchedStopTimeUpdate = stopTimeUpdates.find(stopTimeUpdate => {
      return (stopTimeUpdate.stop_id && stopTimeUpdate.stop_id === stopTime.stop_id) ||
        (stopTimeUpdate.stop_sequence && stopTimeUpdate.stop_sequence === stopTime.stop_sequence)
        ? true
        : false;
    });

    if (matchedStopTimeUpdate) {
      newStopTimeUpdate.schedule_relationship = matchedStopTimeUpdate.schedule_relationship;

      if (matchedStopTimeUpdate.arrival) {
        newStopTimeUpdate.arrival_uncertainty = matchedStopTimeUpdate.arrival.uncertainty;
        if (matchedStopTimeUpdate.arrival.delay) {
          delay = matchedStopTimeUpdate.arrival.delay;
          if (matchedStopTimeUpdate.arrival.time) {
            newStopTimeUpdate.arrival_time = matchedStopTimeUpdate.arrival.time.low;
          } else {
            newStopTimeUpdate.arrival_delay = matchedStopTimeUpdate.arrival.delay;
          }
        } else if (matchedStopTimeUpdate.arrival.time) {
          newStopTimeUpdate.arrival_time = matchedStopTimeUpdate.arrival.time.low;
          // delay = calculate delay
        } else {
          // Incorrect arrival
        }
      } else {
        // No arrival, use previous delay if available
        newStopTimeUpdate.arrival_delay = delay || undefined;
      }

      if (matchedStopTimeUpdate.departure) {
        newStopTimeUpdate.departure_uncertainty = matchedStopTimeUpdate.departure.uncertainty;
        if (matchedStopTimeUpdate.departure.delay) {
          delay = matchedStopTimeUpdate.departure.delay;
          if (matchedStopTimeUpdate.departure.time) {
            newStopTimeUpdate.departure_time = matchedStopTimeUpdate.departure.time.low;
          } else {
            newStopTimeUpdate.departure_delay = matchedStopTimeUpdate.departure.delay;
          }
        } else if (matchedStopTimeUpdate.departure.time) {
          newStopTimeUpdate.arrival_time = matchedStopTimeUpdate.departure.time.low;
          // delay = calculate delay
        } else {
          // Incorrect departure
        }
      } else {
        // No departure, use previous delay if available
        newStopTimeUpdate.departure_delay = delay || undefined;
      }
    } else {
      if (delay) {
        newStopTimeUpdate.arrival_delay = delay;
        newStopTimeUpdate.departure_delay = delay;
      }
    }

    tripUpdateStopTimeUpdates.push(newStopTimeUpdate);
  }

  return tripUpdateStopTimeUpdates;
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
/*
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
*/

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
    trip_start_date: tripUpdate!.trip.start_date || moment().format('YYYYMMDD'), // TODO try to figure out better default than now
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
/*
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
*/
