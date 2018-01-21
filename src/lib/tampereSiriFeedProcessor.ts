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
  monitoredVehicleJourney?: TampereMonitoredVehicleJourney;
}

interface TampereMonitoredVehicleJourney {
  lineRef?: string;
  directionRef?: string;
  framedVehicleJourneyRef?: TampereFramedVehicleJourneyRef;
  operatorRef?: string;
  bearing?: string;
  delay?: string;
  vehicleRef?: string;
  journeyPatternRef?: string;
  originShortName?: string;
  destinationShortName?: string;
  speed?: string;
  originAimedDepartureTime?: string;
  onwardCalls?: TampereOnwardCall[];
}

interface TampereFramedVehicleJourneyRef {
  dateFrameRef?: string;
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
    // Get active services, and cache them
    const tripStart = moment(
      serviceDelivery.monitoredVehicleJourney.framedVehicleJourneyRef.dateFrameRef,
    );

    // Get active services, and cache them
    const tripStartDate = tripStart.format('YYYYMMDD');
    if (!activeServicesMap.has(tripStartDate)) {
      const activeServices = await getActiveServiceIds(regionName, moment(tripStart).toDate());
      activeServicesMap.set(tripStartDate, activeServices);
    }

    // Try to parse infos
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
    const direction = directionRef ? parseInt(directionRef) - 1 : null;
    const vehicleId: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.vehicleRef',
      null,
    );
    const originDepartureDate: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.framedVehicleJourneyRef.dateFrameRef',
      null,
    );
    const originDeparture: string = lodash.get(
      serviceDelivery,
      'monitoredVehicleJourney.originAimedDepartureTime',
      null,
    );
    const originDepartureString = originDeparture
      ? `${originDeparture.substring(0, 2)}:${originDeparture.substring(2, 4)}:00`
      : null;

    // Try to get trip id, match to static GTFS
    const tripId = await getTripId(
      regionName,
      routeId,
      originDepartureString,
      direction,
      activeServicesMap.get(tripStartDate),
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

    const tripUpdateId = `${tripId}_${vehicleId}`;
    tripUpdates.push({
      trip_update_id: tripUpdateId,
      trip_id: tripId,
      route_id: routeId,
      direction_id: direction,
      trip_start_time: originDepartureString,
      trip_start_date: originDepartureDate,
      schedule_relationship: null,
      vehicle_id: lodash.get(serviceDelivery, 'monitoredVehicleJourney.vehicleRef', null),
      vehicle_label: null,
      vehicle_license_plate: null,
      recorded: moment(serviceDelivery.recordedAtTime).format('YYYY-MM-DD HH:mm:ss'),
    });

    // Process stop time updates
    for (const onwardCall of onwardCalls) {
      tripUpdateStopTimeUpdates.push(createStopTimeUpdate(onwardCall, tripUpdateId));
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
function createStopTimeUpdate(
  onwardCall: TampereOnwardCall,
  tripUpdateId: string,
): StopTimeUpdateDB {
  const stopRefUrl = lodash.get(onwardCall, 'stopPointRef', null); // Kind of hack to parse stop id form url
  const expectedArrival = lodash.get(onwardCall, 'expectedArrivalTime', null);
  const expectedDeparture = lodash.get(onwardCall, 'expectedDepartureTime', null);

  return {
    trip_update_id: tripUpdateId,
    stop_sequence: lodash.get(onwardCall, 'order', null),
    stop_id: stopRefUrl ? stopRefUrl.substr(stopRefUrl.lastIndexOf('/') + 1) : undefined,
    arrival_time: expectedArrival ? moment(expectedArrival).unix() : undefined,
    departure_time: expectedDeparture ? moment(expectedDeparture).unix() : undefined,
  };
}
