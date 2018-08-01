import moment from 'moment';
import lodash from 'lodash';
import { updateDatabase, TripUpdateDB, StopTimeUpdateDB } from './databaseUpdater';
import {
  getRouteIdMappings,
  getTripId,
  getTripStops,
  TripStop,
  getActiveServiceIds,
} from './gtfsUtil';

interface TurkuSiriData {
  sys: string;
  status: string;
  servertime: number;
  result: TurkuServiceDelivery;
}

interface TurkuServiceDelivery {
  responsetimestamp: number;
  producerref: string;
  responsemessageidentifier: string;
  status: boolean;
  moredata: boolean;
  vehicles: { [k: string]: TurkuMonitoredVehicle };
}

interface TurkuMonitoredVehicle {
  recordedattime: number;
  validuntiltime: number;
  linkdistance: number;
  percentage: number;
  lineref: string;
  directionref: string;
  publishedlinename: string;
  operatorref: string;
  originref: string;
  originname: string;
  destinationref: string;
  destinationname: string;
  originaimeddeparturetime: number;
  destinationaimedarrivaltime: number;
  monitored: boolean;
  incongestion: boolean;
  inpanic: boolean;
  longitude: number;
  latitude: number;
  delay: string;
  blockref: string;
  vehicleref: string;
  previouscalls?: TurkuVehicleJourneyCall[] | null;
  next_stoppointref: string;
  next_stoppointname: string;
  next_vehicleatstop: boolean;
  next_destinationdisplay: string;
  next_aimedarrivaltime: number;
  next_expectedarrivaltime: number;
  next_aimeddeparturetime: number;
  next_expecteddeparturetime: number;
  onwardcalls?: TurkuVehicleJourneyCall[] | null;
}

interface TurkuVehicleJourneyCall {
  stoppointref: string;
  visitnumber: number;
  stoppointname: string;
  aimedarrivaltime: number;
  expectedarrivaltime: number;
  aimeddeparturetime: number;
  expecteddeparturetime: number;
}

/**
 * Process feed data and store updates to database
 * @param {*} regionName
 * @param {*} feedData
 */
export async function storeTripUpdateFeed(
  regionName: string,
  feedData: TurkuSiriData,
): Promise<number> {
  if (feedData.status !== 'OK') {
    throw new Error(`Invalid data status: ${feedData.status}`);
  }

  const vehicles = lodash.get(feedData, 'result.vehicles', null);
  if (!vehicles || vehicles.length < 1) {
    return 0;
  }

  const tripUpdates: TripUpdateDB[] = [];
  const tripUpdateStopTimeUpdates: StopTimeUpdateDB[] = [];
  const routeIdMap = await getRouteIdMappings(regionName);
  const activeServicesMap = new Map<string, string[]>();

  for (const vehicleProp in vehicles) {
    if (vehicles.hasOwnProperty(vehicleProp)) {
      const vehicle: TurkuMonitoredVehicle = vehicles[vehicleProp];

      if (!vehicle.monitored || !vehicle.originaimeddeparturetime) {
        continue;
      }

      const tripStart = moment.unix(vehicle.originaimeddeparturetime);
      const direction = parseInt(vehicle.directionref, 10) === 2 ? 0 : 1; // Turku uses the opposite logic from HSL or Tampere: 2 is GTFS 0 and 1 is GTFS 1,

      // Get active services, and cache them
      const tripStartDayString = moment(tripStart).format('YYYYMMDD');
      if (!activeServicesMap.has(tripStartDayString)) {
        const activeServices = await getActiveServiceIds(regionName, tripStart.toDate());
        activeServicesMap.set(tripStartDayString, activeServices);
      }

      const routeId = routeIdMap.get(vehicle.lineref);
      const activeServicesDay = activeServicesMap.get(tripStartDayString);

      if (!routeId || !activeServicesDay) {
        // Unable to get route id or activeServicesDay, skip this vehicle
        continue;
      }

      // Try to get trip_id, match to static GTFS
      const tripId = await getTripId(
        regionName,
        routeId,
        tripStart.toDate(),
        direction,
        activeServicesDay,
      );

      if (!tripId) {
        // Unable to get trip id, skip this vehicle
        continue;
      }

      const tripUpdateId = `${tripId}-${tripStart.format('YYYYMMDD')}-${tripStart.format(
        'YYYYMMDD',
      )}`;

      tripUpdates.push({
        id: tripUpdateId,
        trip_id: tripId,
        route_id: routeId,
        direction_id: direction,
        trip_start_date: moment(tripStart).format('YYYYMMDD'),
        trip_start_time: moment(tripStart).format('HH:mm:ss'),
        schedule_relationship: undefined,
        vehicle_id: vehicle.vehicleref,
        vehicle_label: undefined,
        vehicle_license_plate: undefined,
        recorded: moment.unix(vehicle.recordedattime).format('YYYY-MM-DD HH:mm:ss'),
      });

      // Next stop estimations
      const nextStopTimeUpdate = {
        trip_update_id: tripUpdateId,
        stop_id: vehicle.next_stoppointref,
        arrival_time: vehicle.next_expectedarrivaltime,
        departure_time: vehicle.next_expecteddeparturetime,
      };
      tripUpdateStopTimeUpdates.push(nextStopTimeUpdate);

      // There might be onward calls
      if (vehicle.onwardcalls && vehicle.onwardcalls.length) {
        for (const call of vehicle.onwardcalls) {
          const stopTimeUpdate: StopTimeUpdateDB = {
            trip_update_id: tripUpdateId,
            stop_sequence: call.visitnumber,
            stop_id: call.stoppointref,
            arrival_time: call.expectedarrivaltime,
            departure_time: call.expecteddeparturetime,
          };
          tripUpdateStopTimeUpdates.push(stopTimeUpdate);
        }
      }

      // Add missing stop_sequence values
      const tripStops = await getTripStops(regionName, tripId);
      for (const stopTimeUpdate of tripUpdateStopTimeUpdates) {
        if (!stopTimeUpdate.stop_sequence && stopTimeUpdate.stop_id) {
          const stop = tripStops.find((tripStop: TripStop) => {
            return tripStop.stop_id === stopTimeUpdate.stop_id;
          });
          if (stop) {
            stopTimeUpdate.stop_sequence = stop.stop_sequence;
          }
        }
      }
    }
  }

  await updateDatabase(regionName, tripUpdates, tripUpdateStopTimeUpdates);
  return tripUpdates.length;
}
