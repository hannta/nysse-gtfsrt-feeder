import * as moment from 'moment';
import * as lodash from 'lodash';
import { updateDatabase, TripUpdateDB, StopTimeUpdateDB } from './databaseUpdater';
import { getActiveServiceIds, getTripId } from './gtfsUtil';

interface TampereSiriData {
  status: string;
  body: TampereServiceDelivery[];
}

interface TampereServiceDelivery {
  recordedAtTime: string;
  validUntilTime: string;
  monitoredVehicleJourney: TampereMonitoredVehicleJourney;
}

interface TampereMonitoredVehicleJourney {
  lineRef: string;
  directionRef: string;
  framedVehicleJourneyRef: TampereFramedVehicleJourneyRef;
  operatorRef: string;
  bearing?: string;
  delay?: string;
  vehicleRef: string;
  journeyPatternRef?: string;
  originShortName: string;
  destinationShortName: string;
  speed?: string;
  originAimedDepartureTime: string;
  onwardCalls?: TampereOnwardCall[];
}

interface TampereFramedVehicleJourneyRef {
  dateFrameRef: string;
  datedVehicleJourneyRef: string;
}

interface TampereOnwardCall {
  expectedArrivalTime?: string;
  expectedDepartureTime?: string;
  stopPointRef?: string;
  order?: string;
}

/**
 * Store trip update feed to database
 * @param {*} regionName
 * @param {*} feedData
 */
export async function storeTripUpdateFeed(
  regionName: string,
  feedData: TampereSiriData,
): Promise<number> {
  if (feedData.status !== 'success') {
    throw new Error(`Invalid data status: ${feedData.status}`);
  }

  const tripUpdates: TripUpdateDB[] = [];
  const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];
  const activeServicesMap = new Map<string, string[]>();

  for (const serviceDelivery of feedData.body) {
    // Try to parse infos
    const tripStartDateString =
      serviceDelivery.monitoredVehicleJourney.framedVehicleJourneyRef.dateFrameRef;

    const tripStartDateTimeString =
      serviceDelivery.monitoredVehicleJourney.originAimedDepartureTime;

    const tripStartString = `${tripStartDateString} ${tripStartDateTimeString.substring(
      0,
      2,
    )}:${tripStartDateTimeString.substring(2, 4)}`;
    const tripStart = moment(tripStartString);

    const routeId: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.journeyPatternRef',
      null,
    );

    const directionRef: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.directionRef',
      null,
    );

    const direction = directionRef ? parseInt(directionRef, 10) - 1 : 0;

    const vehicleId: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.vehicleRef',
      null,
    );

    // Get active services, and cache them
    const tripStartDate = tripStart.format('YYYYMMDD');
    if (!activeServicesMap.has(tripStartDate)) {
      const activeServices = await getActiveServiceIds(regionName, moment(tripStart).toDate());
      activeServicesMap.set(tripStartDate, activeServices);
    }

    const activeServicesDay = activeServicesMap.get(tripStartDate);
    if (!activeServicesDay) {
      // Failed to get active services, skip
      continue;
    }

    // Try to get trip id, match to static GTFS
    const tripId = await getTripId(
      regionName,
      routeId,
      tripStart.toDate(),
      direction,
      activeServicesDay,
    );

    // Get onward calls, stop time updates
    const onwardCalls: TampereOnwardCall[] = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.onwardCalls',
      null,
    );

    if (!tripId || !onwardCalls) {
      // If no trip id or onward calls, skip this service delivery
      continue;
    }

    tripUpdates.push({
      trip_id: tripId,
      route_id: routeId,
      direction_id: direction,
      trip_start_time: tripStart.format('HH:mm:ss'),
      trip_start_date: tripStart.format('YYYYMMDD'),
      schedule_relationship: undefined,
      vehicle_id: lodash.get(serviceDelivery, 'monitoredVehicleJourney.vehicleRef', null),
      vehicle_label: undefined,
      vehicle_license_plate: undefined,
      recorded: moment(serviceDelivery.recordedAtTime).format('YYYY-MM-DD HH:mm:ss'),
    });

    // Process stop time updates
    for (const onwardCall of onwardCalls) {
      tripUpdateStopTimeUpdates.push(createStopTimeUpdate(tripId, onwardCall));
    }
  }

  await updateDatabase(regionName, tripUpdates, tripUpdateStopTimeUpdates);
  return tripUpdates.length;
}

/**
 * Create stop time update object
 * @param {*} call
 * @param {*} tripUpdateId
 */
function createStopTimeUpdate(tripId: string, onwardCall: TampereOnwardCall): StopTimeUpdateDB {
  const stopRefUrl = lodash.get(onwardCall, 'stopPointRef', null); // Kind of hack to parse stop id form url
  const expectedArrival = lodash.get(onwardCall, 'expectedArrivalTime', null);
  const expectedDeparture = lodash.get(onwardCall, 'expectedDepartureTime', null);
  return {
    trip_id: tripId,
    stop_sequence: lodash.get(onwardCall, 'order', null),
    stop_id: stopRefUrl ? stopRefUrl.substr(stopRefUrl.lastIndexOf('/') + 1) : undefined,
    arrival_time: expectedArrival ? moment(expectedArrival).unix() : undefined,
    departure_time: expectedDeparture ? moment(expectedDeparture).unix() : undefined,
  };
}
