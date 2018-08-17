import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { GtfsRTFeedProcessorSettings, GtfsRTFeedProcessor } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

/**
 * GTFS-RT data provider
 * Fetches data from GTFS-RT data source and stores it to database
 */
export class GtfsRtProvider implements DataProvider {
  public name: string;

  public updateInterval: number;

  private gtfsRTFeedUrl: string;

  private readonly gtfsRTFeedProcessor: GtfsRTFeedProcessor;
  constructor(
    name: string,
    gtfsRTFeedUrl: string,
    updateInterval: number,
    gtfsRTFeedProcessorSettings: GtfsRTFeedProcessorSettings = {
      getMissingTripFromDB: true,
      tryToFixMissingStopId: true,
    },
  ) {
    this.name = name;
    this.gtfsRTFeedUrl = gtfsRTFeedUrl;
    this.updateInterval = updateInterval;
    this.gtfsRTFeedProcessor = new GtfsRTFeedProcessor(name, gtfsRTFeedProcessorSettings);
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
