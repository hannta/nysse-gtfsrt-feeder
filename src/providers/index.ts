import moment from 'moment';
import winstonInstance from '../config/winston';
import { TampereProvider } from '../providers/tampere';
import { TurkuProvider } from '../providers/turku';
import { GtfsRtProvider } from './GtfsRtProvider';

export interface DataProvider {
  name: string;
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
  new GtfsRtProvider(
    'helsinki',
    process.env.HELSINKI_UPDATES_URL!,
    parseInt(process.env.HELSINKI_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'oulu',
    process.env.OULU_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.OULU_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'lahti',
    process.env.LAHTI_GTFSRT_TRIP_UPDATES_URL!,
    parseInt(process.env.LAHTI_UPDATE_INTERVAL!, 10),
  ),
  new GtfsRtProvider(
    'kuopio',
    process.env.KUOPIO_UPDATES_URL!,
    parseInt(process.env.KUOPIO_UPDATE_INTERVAL!, 10),
  ),
  /*
  new GtfsRtProvider(
    'joensuu',
    process.env.JOENSUU_UPDATES_URL!,
    parseInt(process.env.JOENSUU_UPDATE_INTERVAL!, 10),
  ),

  new GtfsRtProvider(
    'joensuu',
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

export async function startDataProviders() {
  for (const dataProvider of dataProviders) {
    winstonInstance.info(`Starting data provider ${dataProvider.name}`);

    const getData = async () => {
      try {
        const tripUpdateCount = await dataProvider.getTripUpdates();
        statusDataMap.set(dataProvider.name, {
          updated: moment().format(),
          lastTripUpdateCount: tripUpdateCount,
        });
      } catch (error) {
        winstonInstance.error(`Data provider ${dataProvider.name} error`, { error });
      } finally {
        setTimeout(getData, dataProvider.updateInterval);
      }
    };

    getData();
  }
}
