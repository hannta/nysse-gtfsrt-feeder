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
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtAlertProvider(
    'lahti',
    process.env.LAHTI_WALTTI_API_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.LAHTI_WALTTI_API_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtAlertProvider(
    'joensuu',
    process.env.JOENSUU_WALTTI_API_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.JOENSUU_WALTTI_API_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtAlertProvider(
    'jyvaskyla',
    process.env.JYVASKYLA_WALTTI_API_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.JYVASKYLA_WALTTI_API_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
    { Authorization: process.env.WALTTI_API_GTFSRT_AUTH_HEADER!! },
  ),
  new GtfsRtAlertProvider(
    'oulu',
    process.env.OULU_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.OULU_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
  ),
  new GtfsRtAlertProvider(
    'kuopio',
    process.env.KUOPIO_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.KUOPIO_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
    { Authorization: process.env.KUOPIO_GTFSRT_SERVICE_AUTH_HEADER!! },
  ),
  new GtfsRtAlertProvider(
    'helsinki',
    process.env.HSL_GTFSRT_SERVICE_ALERTS_URL!!,
    parseInt(process.env.HSL_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
  ),
  new GtfsRtAlertProvider(
    'turku',
    process.env.TURKU_API_GTFSRT_URL!!,
    parseInt(process.env.TURKU_API_GTFSRT_SERVICE_ALERTS_POLLING_INTERVAL!!, 10),
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
