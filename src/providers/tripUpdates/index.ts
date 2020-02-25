import winstonInstance from '../../config/winston';
import { TampereProvider } from './TampereProvider';
import { TurkuProvider } from './TurkuProvider';
import { GtfsRtTripUpdateProvider } from './GtfsRtTripUpdateProvider';
import { DataProviderStatus } from '../../types';

export interface TripUpdatesDataProvider {
  regionKey: string;
  updateInterval: number;
  getTripUpdates: () => Promise<number>;
}

// Active data providers
const dataProviders: TripUpdatesDataProvider[] = [
  new TampereProvider(),
  new TurkuProvider(),
  new GtfsRtTripUpdateProvider(
    'oulu',
    process.env.OULU_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.OULU_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
  ),
  new GtfsRtTripUpdateProvider(
    'kuopio',
    process.env.KUOPIO_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.KUOPIO_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.KUOPIO_GTFSRT_SERVICE_AUTH_HEADER!! },
  ),
  new GtfsRtTripUpdateProvider(
    'lahti',
    process.env.LAHTI_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.LAHTI_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtTripUpdateProvider(
    'joensuu',
    process.env.JOENSUU_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.JOENSUU_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtTripUpdateProvider(
    'jyvaskyla',
    process.env.JYVASKYLA_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.JYVASKYLA_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  /*
  new GtfsRtTripUpdateProvider(
    'tampere',
    process.env.TAMPERE_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.TAMPERE_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  */
];

export const tripUpdateStatusDataMap = new Map<string, DataProviderStatus>();

export async function startTripUpdatesDataProviders() {
  for (const dataProvider of dataProviders) {
    winstonInstance.info(`Starting trip update data provider ${dataProvider.regionKey}`);

    const getData = async () => {
      try {
        const tripUpdateCount = await dataProvider.getTripUpdates();
        tripUpdateStatusDataMap.set(dataProvider.regionKey, {
          updated: new Date(),
          newItemCount: tripUpdateCount,
        });
      } catch (error) {
        winstonInstance.error(`Data provider ${dataProvider.regionKey} error`, {
          error: error.message,
        });
      } finally {
        setTimeout(getData, dataProvider.updateInterval);
      }
    };

    getData();
  }
}
