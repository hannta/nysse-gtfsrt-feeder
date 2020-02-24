import winstonInstance from '../../config/winston';
import { TampereProvider } from './TampereProvider';
import { TurkuProvider } from './TurkuProvider';
import { GtfsRtProvider } from './GtfsRtProvider';
import { DataProviderStatus } from '../../types';

export interface DataProvider {
  regionKey: string;
  updateInterval: number;
  getTripUpdates: () => Promise<number>;
}

// Active data providers
const dataProviders: DataProvider[] = [
  new TampereProvider(),
  new TurkuProvider(),
  new GtfsRtProvider(
    'oulu',
    process.env.OULU_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.OULU_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'kuopio',
    process.env.KUOPIO_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.KUOPIO_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.KUOPIO_GTFSRT_SERVICE_AUTH_HEADER!! },
  ),
  new GtfsRtProvider(
    'lahti',
    process.env.LAHTI_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.LAHTI_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtProvider(
    'joensuu',
    process.env.JOENSUU_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.JOENSUU_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtProvider(
    'jyvaskyla',
    process.env.JYVASKYLA_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.JYVASKYLA_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtProvider(
    'tampere',
    process.env.TAMPERE_WALTTI_API_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.TAMPERE_WALTTI_API_GTFSRT_TRIP_UPDATES_POLLING_INTERVAL!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
];

export const tripUpdateStatusDataMap = new Map<string, DataProviderStatus>();

export async function startTripUpdatesDataProviders() {
  for (const dataProvider of dataProviders) {
    winstonInstance.info(`Starting data provider ${dataProvider.regionKey}`);

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
