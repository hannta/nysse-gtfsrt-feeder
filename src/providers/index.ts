import * as moment from 'moment';
import winstonInstance from '../config/winston';
import { TampereProvider } from '../providers/tampere';
import { TurkuProvider } from '../providers/turku';
import { HelsinkiProvider } from '../providers/helsinki';
import { GtfsRtProvider } from './GtfsRtProvider';
// import { JoensuuProvider } from '../providers/joensuu';
// import { JyvaskylaProvider } from '../providers/jyvaskyla';
// import { LappeenrantaProvider } from '../providers/lappeenranta';

export interface DataProvider {
  name: string;
  updateInterval: number;
  getTripUpdates: () => Promise<number>;
}

export interface DataProviderStatus {
  updated: string;
  lastTripUpdateCount: number;
}

const dataProviders: DataProvider[] = [
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
  new TampereProvider(),
  new TurkuProvider(),
  new HelsinkiProvider(),
  // new JoensuuProvider(),
  // new JyvaskylaProvider(),
  // new LappeenrantaProvider(),
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
        winstonInstance.error(`Data provider ${dataProvider.name} error`, error.message);
      } finally {
        setTimeout(getData, dataProvider.updateInterval);
      }
    };

    getData();
  }
}
