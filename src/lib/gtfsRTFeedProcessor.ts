import moment from 'moment';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import winstonInstance from '../config/winston';
import { TripUpdateDB, StopTimeUpdateDB, updateDatabase } from '../lib/databaseUpdater';
import {
  getActiveServiceIds,
  getTripId,
  getTripStopTimes,
  StopTime,
  getTripById,
} from '../lib/gtfsUtil';

/**
 * GTFS-RT feed processor config options
 */
export interface GtfsRTFeedProcessorSettings {
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
 * GTFS-RT feed processor
 *
 * Parses GTFS-RT trip update feed and stores data to database
 */
export class GtfsRTFeedProcessor {
  private readonly regionName: string;
  private readonly options?: GtfsRTFeedProcessorSettings;
  private readonly activeServicesMap: Map<string, string[]>;

  constructor(regionName: string, options?: GtfsRTFeedProcessorSettings) {
    this.regionName = regionName;
    this.options = options;
    this.activeServicesMap = new Map<string, string[]>();
  }

  /**
   * Store trip update feed to database
   *
   * @param feedBinary
   */
  public async storeTripUpdateFeed(feedBinary: any) {
    const feedData: FeedMessage = GtfsRealtimeBindings.FeedMessage.decode(feedBinary);

    if (!feedData || !feedData.entity) {
      // There should be at least empty entity(?)
      throw new Error('No feed data');
    }

    const dbTripUpdates: TripUpdateDB[] = [];
    const dbTripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];

    for (const entity of feedData.entity) {
      if (
        !entity ||
        !entity.trip_update ||
        !entity.trip_update.trip ||
        !entity.trip_update.stop_time_update
      ) {
        winstonInstance.info('Empty trip update, skipping.', entity);
        continue;
      }

      const recorded = entity.trip_update.timestamp
        ? new Date(entity.trip_update.timestamp.low * 1000)
        : new Date(feedData.header.timestamp.low * 1000);
      const tripDescriptor = entity.trip_update.trip;

      if (tripDescriptor.trip_id) {
        const tripStopTimes = await getTripStopTimes(this.regionName, tripDescriptor.trip_id);
        if (!tripStopTimes || tripStopTimes.length < 1) {
          // Incorrect trip / no trip stop times
          winstonInstance.info('No stop times for trip.', { tripId: tripDescriptor.trip_id });
          continue;
        }

        const tripStartDate = tripDescriptor.start_date
          ? tripDescriptor.start_date
          : this.findTripStartDate(tripDescriptor.trip_id, tripStopTimes); // E.g. Oulu feed does not have trip start :(
        const tripStartTime = tripDescriptor.start_time
          ? tripDescriptor.start_time
          : tripStopTimes[0].departure_time;
        let routeId = tripDescriptor.route_id;
        let directionId = tripDescriptor.direction_id;
        if (!routeId || !directionId) {
          const trip = await getTripById(this.regionName, tripDescriptor.trip_id);
          routeId = routeId || trip.route_id;
          directionId = directionId || trip.direction_id;
        }

        const data = this.processTripUpdate({
          tripId: tripDescriptor.trip_id,
          tripStartDate,
          tripStartTime,
          tripStopTimeUpdates: entity.trip_update.stop_time_update,
          tripStopTimes,
          routeId,
          directionId,
          scheduleRelationship: tripDescriptor.schedule_relationship || 1,
          recorded,
          vehicle: entity.trip_update.vehicle,
        });
        dbTripUpdates.push(data.tripUpdate);
        dbTripUpdateStopTimeUpdates.push(...data.stopTimeUpdates);
      } else if (
        !tripDescriptor.trip_id &&
        tripDescriptor.route_id &&
        tripDescriptor.direction_id &&
        tripDescriptor.start_date &&
        tripDescriptor.start_time
      ) {
        // No trip id, try to get from database
        const tripId = await this.getTripIdFromDb(
          tripDescriptor.route_id,
          tripDescriptor.direction_id,
          tripDescriptor.start_date,
          tripDescriptor.start_time,
        );

        if (!tripId) {
          // Failed to get trip id, skip this entity
          winstonInstance.info('Unable to get trip id from db, skipping.', tripDescriptor);
          continue;
        }

        const tripStopTimes = await getTripStopTimes(this.regionName, tripId);
        if (!tripStopTimes || tripStopTimes.length < 1) {
          // Incorrect trip / no trip stop times
          winstonInstance.info('No stop times for matched trip id, skipping.', { tripId });
          continue;
        }

        const data = this.processTripUpdate({
          tripId,
          tripStartDate: tripDescriptor.start_date,
          tripStartTime: tripDescriptor.start_time,
          tripStopTimeUpdates: entity.trip_update.stop_time_update,
          tripStopTimes,
          routeId: tripDescriptor.route_id,
          directionId: tripDescriptor.direction_id,
          scheduleRelationship: tripDescriptor.schedule_relationship || 1,
          recorded,
          vehicle: entity.trip_update.vehicle,
        });
        dbTripUpdates.push(data.tripUpdate);
        dbTripUpdateStopTimeUpdates.push(...data.stopTimeUpdates);
      } else {
        // Not enough info to process this trip update
        winstonInstance.info(
          'Trip update entity does not have enough information to process, skipping.',
          entity,
        );
        continue;
      }
    }

    await updateDatabase(
      this.regionName,
      dbTripUpdates,
      dbTripUpdateStopTimeUpdates,
      this.options ? this.options.keepOldRecords : undefined,
    );

    this.activeServicesMap.clear();
    return dbTripUpdates.length;
  }

  /**
   * Process trip update, create tripUpdateDb and stop time updates
   * @param param
   */
  private processTripUpdate({
    tripId,
    tripStartDate,
    tripStartTime,
    tripStopTimeUpdates,
    tripStopTimes,
    routeId,
    directionId,
    scheduleRelationship,
    recorded,
    vehicle,
  }: {
    tripId: string;
    tripStartDate: string;
    tripStartTime: string;
    tripStopTimeUpdates: StopTimeUpdate[];
    tripStopTimes: StopTime[];
    routeId: string;
    directionId: number;
    scheduleRelationship: number;
    recorded: Date;
    vehicle?: VehicleDescriptor;
  }) {
    const tripUpdateId = `${tripId}-${tripStartDate}-${tripStartTime}`;
    const stopTimeUpdateDBs = this.createStopTimeUpdates(
      tripUpdateId,
      tripStopTimes,
      tripStopTimeUpdates,
    );

    const tripUpdateDb = {
      id: tripUpdateId,
      trip_id: tripId,
      route_id: routeId,
      direction_id: directionId,
      trip_start_time: tripStartTime,
      trip_start_date: tripStartDate,
      schedule_relationship: scheduleRelationship,
      vehicle_id: vehicle ? vehicle.id : undefined,
      vehicle_label: vehicle ? vehicle.label : undefined,
      vehicle_license_plate: vehicle ? vehicle.license_plate : undefined,
      recorded: moment(recorded).format('YYYY-MM-DD HH:mm:ss'),
    };

    return {
      tripUpdate: tripUpdateDb,
      stopTimeUpdates: stopTimeUpdateDBs,
    };
  }

  /**
   * Create stop time updates matching stop timetable times and gtfs-rt stop time updates
   *
   * @param tripUpdateId
   * @param tripStopTimes
   * @param stopTimeUpdates
   */
  private createStopTimeUpdates(
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
            // No arrival, use previous delay if available
            newStopTimeUpdate.arrival_delay = delay || undefined;
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
            // No departure, use previous delay if available
            newStopTimeUpdate.departure_delay = delay || undefined;
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
   * Try to find trip start date for trip
   * @param tripId
   * @param tripStopTimes
   */
  private findTripStartDate(tripId: string, tripStopTimes: StopTime[]) {
    // TODO!
    return moment().format('YYYYMMDD');
  }

  /**
   * Try to get trip id from DB
   * @param routeId
   * @param directionId
   * @param startDate
   * @param startTime
   */
  private async getTripIdFromDb(
    routeId: string,
    directionId: number,
    startDate: string,
    startTime: string,
  ) {
    const tripStart = moment(`${startDate} ${startTime}`, 'YYYYMMDD HH:mm:ss').toDate();

    // Get active services, and cache them
    if (!this.activeServicesMap.has(startDate)) {
      const activeServices = await getActiveServiceIds(this.regionName, tripStart);
      this.activeServicesMap.set(startDate, activeServices);
    }

    const activeServicesDay = this.activeServicesMap.get(startDate);
    if (!activeServicesDay || activeServicesDay.length < 1) {
      // Unable to get active services
      return null;
    }

    return getTripId(this.regionName, routeId, tripStart, directionId, activeServicesDay);
  }
}
