import Axios, { AxiosRequestConfig } from 'axios';
import { GtfsRTAlertFeedProcessor } from './lib/GtfsRTAlertFeedProcessor';
import config from '../../config/config';
import { AlertDataProvider } from '.';

export class GtfsRtAlertProvider implements AlertDataProvider {
  public readonly regionKey: string;

  public readonly updateInterval: number;

  private readonly gtfsRTFeedUrl: string;

  private readonly requestHeaders?: { [k: string]: string };

  private readonly gtfsRTAlertFeedProcessor: GtfsRTAlertFeedProcessor;

  constructor(
    regionKey: string,
    gtfsRTFeedUrl: string,
    updateInterval: number,
    requestHeaders?: { [k: string]: string },
  ) {
    this.regionKey = regionKey;
    this.gtfsRTFeedUrl = gtfsRTFeedUrl;
    this.updateInterval = updateInterval;
    this.requestHeaders = requestHeaders;
    this.gtfsRTAlertFeedProcessor = new GtfsRTAlertFeedProcessor(regionKey);
  }

  public async getAlerts() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: this.gtfsRTFeedUrl,
      responseType: 'arraybuffer',
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': config.serverUserAgent,
        ...this.requestHeaders,
      },
      timeout: 5000,
    };

    const resp = await Axios.request(requestConfig);
    return this.gtfsRTAlertFeedProcessor.storeAlertsUpdateFeed(resp.data);
  }
}
