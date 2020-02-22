import { GtfsRtAlertProvider } from './GtfsRtAlertProvider';
import winstonInstance from '../../config/winston';
import { DataProviderStatus } from '../../types';

export interface AlertDataProvider {
  regionKey: string;
  updateInterval: number;
  getAlerts: () => Promise<number>;
}

const alertDataProviders: AlertDataProvider[] = [
  new GtfsRtAlertProvider(
    'tampere',
    process.env.TAMPERE_WALTTI_API_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.TAMPERE_WALTTI_API_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
    { Authorization: process.env.TAMPERE_WALTTI_API_GTFSRT_AUTH!! },
  ),
];

export const alertsStatusDataMap = new Map<string, DataProviderStatus>();

export async function startAlertDataProviders() {
  for (const alertDataProvider of alertDataProviders) {
    winstonInstance.info(`Starting alert data provider ${alertDataProvider.regionKey}`);

    const getData = async () => {
      try {
        const alertsCount = await alertDataProvider.getAlerts();
        alertsStatusDataMap.set(alertDataProvider.regionKey, {
          updated: new Date(),
          newItemCount: alertsCount,
        });
      } catch (error) {
        winstonInstance.error(`Alert data provider ${alertDataProvider.regionKey} error`, {
          error: error.message,
        });
      } finally {
        setTimeout(getData, alertDataProvider.updateInterval);
      }
    };

    getData();
  }
}
