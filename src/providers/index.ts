import * as moment from 'moment';
import winstonInstance from '../config/winston';
import { OuluProvider } from '../providers/oulu';
import { LahtiProvider } from '../providers/lahti';
import { TampereProvider } from '../providers/tampere';

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
];

export const statusDataMap = new Map<string, DataProviderStatus>();

export async function startDataProviders() {
  for (const dataProvider of dataProviders) {
    console.info(`Starting data provider ${dataProvider.name}`);

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
