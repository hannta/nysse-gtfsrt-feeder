import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { GtfsRTFeedProcessorSettings, GtfsRTFeedProcessor } from '../lib/GtfsRTFeedProcessor';
import { DataProvider } from '../providers';

/**
 * GTFS-RT data provider
 * Fetches data from GTFS-RT data source and stores it to database
 */
export class GtfsRtProvider implements DataProvider {
  public readonly regionKey: string;

  public readonly updateInterval: number;

  private readonly gtfsRTFeedUrl: string;

  private readonly gtfsRTFeedProcessor: GtfsRTFeedProcessor;

  constructor(
    regionKey: string,
    gtfsRTFeedUrl: string,
    updateInterval: number,
    gtfsRTFeedProcessorSettings?: GtfsRTFeedProcessorSettings,
  ) {
    this.regionKey = regionKey;
    this.gtfsRTFeedUrl = gtfsRTFeedUrl;
    this.updateInterval = updateInterval;
    this.gtfsRTFeedProcessor = new GtfsRTFeedProcessor(regionKey, gtfsRTFeedProcessorSettings);
  }

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: this.gtfsRTFeedUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    return this.gtfsRTFeedProcessor.storeTripUpdateFeed(resp.data);
  }
}
