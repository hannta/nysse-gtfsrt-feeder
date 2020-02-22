import moment from 'moment';
import winstonInstance from '../../config/winston';
import { TampereProvider } from './TampereProvider';
import { TurkuProvider } from './TurkuProvider';
import { GtfsRtProvider } from './GtfsRtProvider';

export interface DataProvider {
  regionKey: string;
  updateInterval: number;
  getTripUpdates: () => Promise<number>;
}

export interface DataProviderStatus {
  updated: string;
  lastTripUpdateCount: number;
}

// Active data providers
const dataProviders: DataProvider[] = [
  new TampereProvider(),
  new TurkuProvider(),
  /*
  new GtfsRtProvider(
    'helsinki',
    process.env.HELSINKI_UPDATES_URL!,
    parseInt(process.env.HELSINKI_UPDATE_INTERVAL!, 10),
  ),
  */
  new GtfsRtProvider(
    'oulu',
    process.env.OULU_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.OULU_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'kuopio',
    process.env.KUOPIO_UPDATES_URL!,
    parseInt(process.env.KUOPIO_UPDATE_INTERVAL!, 10),
  ),
  /*
    new GtfsRtProvider(
    'lahti',
    process.env.LAHTI_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.LAHTI_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'joensuu',
    process.env.JOENSUU_UPDATES_URL!,
    parseInt(process.env.JOENSUU_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'jyvaskyla',
    process.env.JYVASKYLA_UPDATES_URL!,
    parseInt(process.env.JYVASKYLA_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'lappeenranta',
    process.env.LAPPEENRANTA_UPDATES_URL!,
    parseInt(process.env.LAPPEENRANTA_UPDATE_INTERVAL!, 10),
  ),
  */
];

export const statusDataMap = new Map<string, DataProviderStatus>();

export async function startTripUpdatesDataProviders() {
  for (const dataProvider of dataProviders) {
    winstonInstance.info(`Starting data provider ${dataProvider.regionKey}`);

    const getData = async () => {
      try {
        const tripUpdateCount = await dataProvider.getTripUpdates();
        statusDataMap.set(dataProvider.regionKey, {
          updated: moment().format(),
          lastTripUpdateCount: tripUpdateCount,
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
