import moment from 'moment';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import winstonInstance from '../config/winston';
import { TripUpdateDB, StopTimeUpdateDB, updateDatabase } from './databaseUpdater';
import {
  getActiveServiceIds,
  getTripId,
  getTripStopTimes,
  StopTime,
  getTripById,
} from './gtfsUtil';

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
  gtfsRealtimeVersion: string;
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
  isDeleted?: boolean;
  tripUpdate?: TripUpdate;
}

interface TripUpdate {
  trip: TripDescriptor;
  vehicle?: VehicleDescriptor;
  stopTimeUpdate?: StopTimeUpdate[];
  timestamp?: Timestamp;
  delay?: number;
}

interface TripDescriptor {
  tripId?: string;
  routeId?: string;
  directionId?: number;
  startTime?: string;
  startDate?: string;
  scheduleRelationship?: number; // Enum
}

interface VehicleDescriptor {
  id?: string;
  label?: string;
  licensePlate?: string;
}

interface StopTimeUpdate {
  stopSequence?: number;
  stopId?: string;
  arrival?: StopTimeEvent;
  departure?: StopTimeEvent;
  scheduleRelationship?: number; // Enum
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
  private readonly regionKey: string;
  private readonly options?: GtfsRTFeedProcessorSettings;
  private readonly activeServicesMap: Map<string, string[]>;

  constructor(regionKey: string, options?: GtfsRTFeedProcessorSettings) {
    this.regionKey = regionKey;
    this.options = options;
    this.activeServicesMap = new Map<string, string[]>();
  }

  /**
   * Store trip update feed to database
   *
   * @param feedBinary
   */
  public async storeTripUpdateFeed(feedBinary: any) {
    const feedData: FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      feedBinary,
    );

    if (!feedData || !feedData.entity) {
      // There should be at least empty entity(?)
      throw new Error('No feed data');
    }

    const dbTripUpdates: TripUpdateDB[] = [];
    const dbTripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];

    for (const entity of feedData.entity) {
      if (
        !entity ||
        !entity.tripUpdate ||
        !entity.tripUpdate.trip ||
        !entity.tripUpdate.stopTimeUpdate
      ) {
        winstonInstance.info('Empty trip update / entity, skipping.', {
          regionKey: this.regionKey,
          entity,
        });
        continue;
      }

      const recorded = entity.tripUpdate.timestamp
        ? new Date(entity.tripUpdate.timestamp.low * 1000)
        : new Date(feedData.header.timestamp.low * 1000);
      const tripDescriptor = entity.tripUpdate.trip;

      const tripId = tripDescriptor.tripId
        ? tripDescriptor.tripId
        : await this.getTripIdFromDb(
            tripDescriptor.routeId,
            tripDescriptor.directionId,
            tripDescriptor.startDate,
            tripDescriptor.startTime,
          );
      if (!tripId) {
        // Trip id missing from GTFS-RT data and failed to get trip id from Nysse database
        winstonInstance.info('No trip id and failed to get it from db', {
          regionKey: this.regionKey,
          tripDescriptor,
        });
        continue;
      }

      const tripStopTimes = await getTripStopTimes(this.regionKey, tripId);
      if (!tripStopTimes || tripStopTimes.length < 1) {
        // Incorrect trip / no trip stop times found from Nysse database
        winstonInstance.info('No stop times for trip.', {
          regionKey: this.regionKey,
          tripId: tripDescriptor.tripId,
        });
        continue;
      }

      const tripStartDate = tripDescriptor.startDate
        ? tripDescriptor.startDate
        : this.findTripStartDate(tripId, tripStopTimes); // E.g. Oulu feed does not have trip start :(
      const tripStartTime = tripDescriptor.startTime
        ? tripDescriptor.startTime
        : tripStopTimes[0].departure_time;
      let routeId = tripDescriptor.routeId;
      let directionId = tripDescriptor.directionId;
      if (!routeId || !directionId) {
        const trip = await getTripById(this.regionKey, tripId);
        routeId = routeId || trip.route_id;
        directionId = directionId || trip.direction_id;
      }

      const data = this.processTripUpdate({
        tripId,
        tripStartDate,
        tripStartTime,
        tripStopTimeUpdates: entity.tripUpdate.stopTimeUpdate,
        tripStopTimes,
        routeId,
        directionId,
        scheduleRelationship: tripDescriptor.scheduleRelationship || 0,
        recorded,
        vehicle: entity.tripUpdate.vehicle,
      });
      dbTripUpdates.push(data.tripUpdate);
      dbTripUpdateStopTimeUpdates.push(...data.stopTimeUpdates);
    }

    await updateDatabase(
      this.regionKey,
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
      vehicle_license_plate: vehicle ? vehicle.licensePlate : undefined,
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
        return (stopTimeUpdate.stopId && stopTimeUpdate.stopId === stopTime.stop_id) ||
          (stopTimeUpdate.stopSequence && stopTimeUpdate.stopSequence === stopTime.stop_sequence)
          ? true
          : false;
      });

      if (matchedStopTimeUpdate) {
        newStopTimeUpdate.schedule_relationship = matchedStopTimeUpdate.scheduleRelationship;

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
            delay = this.getDelay(matchedStopTimeUpdate.arrival.time, stopTime.arrival_time);
          } else {
            // No arrival, use previous delay if available
            newStopTimeUpdate.arrival_delay = delay || undefined;
          }
        } else {
          // No arrival data at all, use previous delay if available
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
            delay = this.getDelay(matchedStopTimeUpdate.departure.time, stopTime.departure_time);
          } else {
            // No departure, use previous delay if available
            newStopTimeUpdate.departure_delay = delay || undefined;
          }
        } else {
          // No departure data at all, use previous delay if available
          newStopTimeUpdate.departure_delay = delay || undefined;
        }
      } else {
        // Unable to mach to stop time update, use previous delay
        newStopTimeUpdate.arrival_delay = delay;
        newStopTimeUpdate.departure_delay = delay;
      }

      if (
        !newStopTimeUpdate.arrival_delay &&
        !newStopTimeUpdate.arrival_time &&
        !newStopTimeUpdate.departure_delay &&
        !newStopTimeUpdate.departure_time
      ) {
        // If we do not have any times for stop time update, skip.
        continue;
      }

      tripUpdateStopTimeUpdates.push(newStopTimeUpdate);
    }

    return tripUpdateStopTimeUpdates;
  }

  /**
   * Calculate delay between stop time update and stop time
   * @param stopTimeUpdate
   * @param stopTime
   */
  private getDelay(stopTimeUpdate: Timestamp, stopTime: string) {
    const updateTime = moment(stopTimeUpdate.low * 1000);
    const currentStopTimeParts = stopTime.split(':');
    const currentStopTime = moment(updateTime)
      .hour(parseInt(currentStopTimeParts[0], 10))
      .minute(parseInt(currentStopTimeParts[1], 10))
      .seconds(parseInt(currentStopTimeParts[2], 10));
    return moment.duration(updateTime.diff(currentStopTime)).asSeconds();
  }

  /**
   * Try to find trip start date for trip
   * @param tripId
   * @param tripStopTimes
   */
  private findTripStartDate(tripId: string, tripStopTimes: StopTime[]) {
    // TODO!
    // This is used in Oulu as their GTFS-RT data does not contain trip start
    // With this implementation, trip updates which runs over midnight, does not work after midnight
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
    routeId?: string,
    directionId?: number,
    startDate?: string,
    startTime?: string,
  ) {
    if (!routeId || !directionId || !startDate || !startTime) {
      return undefined;
    }

    const tripStart = moment(`${startDate} ${startTime}`, 'YYYYMMDD HH:mm:ss').toDate();

    // Get active services, and cache them
    if (!this.activeServicesMap.has(startDate)) {
      const activeServices = await getActiveServiceIds(this.regionKey, tripStart);
      this.activeServicesMap.set(startDate, activeServices);
    }

    const activeServicesDay = this.activeServicesMap.get(startDate);
    if (!activeServicesDay || activeServicesDay.length < 1) {
      // Unable to get active services
      return undefined;
    }

    return getTripId(this.regionKey, routeId, tripStart, directionId, activeServicesDay);
  }
}
