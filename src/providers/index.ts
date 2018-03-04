import * as moment from 'moment';
import winstonInstance from '../config/winston';
import { OuluProvider } from '../providers/oulu';
import { LahtiProvider } from '../providers/lahti';
import { TampereProvider } from '../providers/tampere';
import { TurkuProvider } from '../providers/turku';
import { HelsinkiProvider } from '../providers/helsinki';
// import { KuopioProvider } from '../providers/kuopio';
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
  new OuluProvider(),
  new LahtiProvider(),
  new TampereProvider(),
  new TurkuProvider(),
  new HelsinkiProvider(),
  // new KuopioProvider(),
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
