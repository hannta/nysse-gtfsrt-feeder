import moment from 'moment';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import winstonInstance from '../../../config/winston';
import { TripUpdateDB, StopTimeUpdateDB, updateDatabase } from './tripUpdateDatabaseUpdater';
import {
  getActiveServiceIds,
  getTripId,
  getTripStopTimes,
  StopTime,
  getTripById,
} from '../../../lib/gtfsUtil';
import {
  FeedMessage,
  StopTimeUpdate,
  VehicleDescriptor,
  ScheduleRelationship,
} from '../../../types';

/**
 * GTFS-RT feed processor config options
 */
export interface GtfsRTFeedProcessorSettings {
  /** How old records to keep, seconds  */
  keepOldRecords?: number;

  /** Get trip routeId and direction from nysse database. This fixes e.g. "incorrect" routeId if in Tampere data */
  updateTripInfoFromDb?: boolean;
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
      throw new Error('No feed data');
    }

    const isFullDataset = feedData.header.incrementality === 0; // 0 = FULL_DATASET

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

      const tripId =
        tripDescriptor.tripId ??
        (await this.getTripIdFromDb(
          tripDescriptor.routeId,
          tripDescriptor.directionId,
          tripDescriptor.startDate,
          tripDescriptor.startTime,
        ));

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
        winstonInstance.info('No trip stop times found from Nysse database.', {
          regionKey: this.regionKey,
          tripId: tripDescriptor.tripId,
        });
        continue;
      }

      const tripStartDate =
        tripDescriptor.startDate ?? this.findTripStartDate(tripId, tripStopTimes); // E.g. Oulu feed does not have trip start :(
      const tripStartTime = tripDescriptor.startTime ?? tripStopTimes[0].departure_time;

      let routeId = tripDescriptor.routeId;
      let directionId = tripDescriptor.directionId;

      // Get routeId and directionId from Nysse db
      if (this.options?.updateTripInfoFromDb || !routeId || !directionId) {
        const trip = await getTripById(this.regionKey, tripId);
        if (!trip) {
          winstonInstance.info('No trip found from Nysse database.', {
            regionKey: this.regionKey,
            tripId,
          });
          continue;
        }
        routeId = trip.route_id;
        directionId = trip.direction_id;
      }

      const tripScheduleRelationship = this.convertTripScheduleRelationship(
        tripDescriptor.scheduleRelationship,
      );

      const data = this.processTripUpdate({
        tripId,
        tripStartDate,
        tripStartTime,
        tripStopTimeUpdates: entity.tripUpdate.stopTimeUpdate,
        tripStopTimes,
        routeId,
        directionId,
        scheduleRelationship: tripScheduleRelationship,
        recorded,
        vehicle: entity.tripUpdate.vehicle,
      });

      dbTripUpdates.push(data.tripUpdate);
      dbTripUpdateStopTimeUpdates.push(...data.stopTimeUpdates);
    }

    await updateDatabase(
      isFullDataset,
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
    scheduleRelationship: string;
    recorded: Date;
    vehicle?: VehicleDescriptor;
  }) {
    const tripUpdateId = `${tripId}-${tripStartDate}-${tripStartTime}`;

    const tripUpdateDb = {
      id: tripUpdateId,
      trip_id: tripId,
      route_id: routeId,
      direction_id: directionId,
      trip_start_time: tripStartTime,
      trip_start_date: tripStartDate,
      schedule_relationship: scheduleRelationship,
      vehicle_id: vehicle?.id,
      vehicle_label: vehicle?.label,
      vehicle_license_plate: vehicle?.licensePlate,
      recorded: moment(recorded).format('YYYY-MM-DD HH:mm:ss'),
    };

    // Build stop times only if scheduled relationship is scheduled
    const stopTimeUpdateDBs =
      scheduleRelationship === ScheduleRelationship.SCHEDULED
        ? this.createStopTimeUpdates(tripUpdateId, tripStopTimes, tripStopTimeUpdates)
        : [];

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
    if (tripStopTimes.length < 1) {
      return [];
    }

    const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];

    let delay: number | undefined;
    let firstDelay: number | undefined; // This trip's first realtime delay

    for (const stopTime of tripStopTimes) {
      const newStopTimeUpdate: StopTimeUpdateDB = {
        trip_update_id: tripUpdateId,
        stop_id: stopTime.stop_id,
        stop_sequence: stopTime.stop_sequence,
        schedule_relationship: ScheduleRelationship.SCHEDULED, // Default to SCHEDULED
      };

      // Try to find stop time match to stop time update
      const matchedStopTimeUpdate = stopTimeUpdates.find((stopTimeUpdate) => {
        return (stopTimeUpdate.stopId && stopTimeUpdate.stopId === stopTime.stop_id) ||
          (stopTimeUpdate.stopSequence && stopTimeUpdate.stopSequence === stopTime.stop_sequence)
          ? true
          : false;
      });

      if (matchedStopTimeUpdate) {
        newStopTimeUpdate.schedule_relationship = this.convertStopTimeScheduleRelationship(
          matchedStopTimeUpdate.scheduleRelationship,
        );

        if (newStopTimeUpdate.schedule_relationship === ScheduleRelationship.NO_DATA) {
          // No stop time data
          delay = 0;
          firstDelay = firstDelay ?? delay;
          continue;
        }

        if (newStopTimeUpdate.schedule_relationship === ScheduleRelationship.SKIPPED) {
          // No stop time data
          delay = 0;
          firstDelay = firstDelay ?? delay;
          continue;
        }

        // Update arrival & departure
        let arrival;
        let departure;

        if (
          matchedStopTimeUpdate.arrival &&
          (matchedStopTimeUpdate.arrival.time || matchedStopTimeUpdate.arrival.time)
        ) {
          arrival = matchedStopTimeUpdate.arrival;
        }

        if (
          matchedStopTimeUpdate.departure &&
          (matchedStopTimeUpdate.departure.time || matchedStopTimeUpdate.departure.time)
        ) {
          departure = matchedStopTimeUpdate.departure;
        }

        if (!arrival && departure) {
          arrival = departure;
        }

        if (!departure && arrival) {
          departure = arrival;
        }

        if (arrival) {
          newStopTimeUpdate.arrival_uncertainty = arrival.uncertainty;

          if (arrival.delay) {
            delay = arrival.delay;
            firstDelay = firstDelay ?? delay;
            if (arrival.time) {
              newStopTimeUpdate.arrival_time = arrival.time.low;
            } else {
              newStopTimeUpdate.arrival_delay = arrival.delay;
            }
          } else if (arrival.time) {
            newStopTimeUpdate.arrival_time = arrival.time.low;
            delay = this.getDelay(arrival.time.low, stopTime.arrival_time);
            firstDelay = firstDelay ?? delay;
          } else {
            // Incorrect arrival info, no time or delay
            winstonInstance.error('Incorrect stop time, skipping', {
              trip_update_id: tripUpdateId,
              regionKey: this.regionKey,
            });
            continue;
          }
        } else {
          // No arrival, use previous delay if available
          newStopTimeUpdate.arrival_delay = delay;
          winstonInstance.info(
            'Stop time update does not have arrival info, using delay if available',
            {
              trip_update_id: tripUpdateId,
              regionKey: this.regionKey,
            },
          );
        }

        if (departure) {
          newStopTimeUpdate.departure_uncertainty = departure.uncertainty;

          if (departure.delay) {
            delay = departure.delay;
            firstDelay = firstDelay ?? delay;
            if (departure.time) {
              newStopTimeUpdate.departure_time = departure.time.low;
            } else {
              newStopTimeUpdate.departure_delay = departure.delay;
            }
          } else if (departure.time) {
            newStopTimeUpdate.departure_time = departure.time.low;
            delay = this.getDelay(departure.time.low, stopTime.departure_time);
            firstDelay = firstDelay ?? delay;
          } else {
            // Incorrect departure info, no time or delay
            winstonInstance.error('Incorrect stop time, skipping', {
              trip_update_id: tripUpdateId,
              regionKey: this.regionKey,
            });
            continue;
          }
        } else {
          // No departure, use previous delay if available
          newStopTimeUpdate.departure_delay = delay;
          winstonInstance.info(
            'Stop time update does not have departure info, using delay if available',
            {
              trip_update_id: tripUpdateId,
              regionKey: this.regionKey,
            },
          );
        }
      } else {
        // Unable to mach to stop time update, use previous delay
        newStopTimeUpdate.arrival_delay = delay;
        newStopTimeUpdate.departure_delay = delay;
      }

      tripUpdateStopTimeUpdates.push(newStopTimeUpdate);

      if (
        firstDelay !== null &&
        firstDelay !== undefined &&
        !tripUpdateStopTimeUpdates[0].arrival_time &&
        !tripUpdateStopTimeUpdates[0].arrival_delay &&
        !tripUpdateStopTimeUpdates[0].departure_time &&
        !tripUpdateStopTimeUpdates[0].departure_delay
      ) {
        // Populate delay to previous (past) stop times which does not have realtime data.
        for (const update of tripUpdateStopTimeUpdates) {
          if (
            update.arrival_time ||
            update.arrival_delay ||
            update.departure_time ||
            update.departure_delay
          ) {
            break;
          }
          update.arrival_delay = firstDelay;
          update.departure_delay = firstDelay;
        }
      }
    }

    return tripUpdateStopTimeUpdates;
  }

  /**
   * Calculate delay between stop time update and stop time
   * @param stopTimeUpdate
   * @param stopTime
   */
  private getDelay(stopTimeUpdate: number, stopTime: string) {
    const updateTime = moment(stopTimeUpdate * 1000);
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

  private convertTripScheduleRelationship(value?: number): ScheduleRelationship {
    switch (value) {
      case 0:
        return ScheduleRelationship.SCHEDULED;
      case 1:
        return ScheduleRelationship.ADDED;
      case 2:
        return ScheduleRelationship.UNSCHEDULED;
      case 3:
        return ScheduleRelationship.CANCELED;
      case 5:
        return ScheduleRelationship.REPLACEMENT;
      default:
        return ScheduleRelationship.SCHEDULED;
    }
  }

  private convertStopTimeScheduleRelationship(value?: number): ScheduleRelationship {
    switch (value) {
      case 0:
        return ScheduleRelationship.SCHEDULED;
      case 1:
        return ScheduleRelationship.SCHEDULED;
      case 2:
        return ScheduleRelationship.NO_DATA;
      default:
        return ScheduleRelationship.SCHEDULED;
    }
  }
}
