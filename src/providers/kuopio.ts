import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed, GtfsRTFeedProcessorConfig } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class KuopioProvider implements DataProvider {
  public name = 'kuopio';

  public updateInterval = parseInt(process.env.KUOPIO_UPDATE_INTERVAL!, 10);

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: process.env.KUOPIO_UPDATES_URL,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);

    const gtfsRTFeedProcessorConfig: GtfsRTFeedProcessorConfig = {
      getMissingTripFromDB: true,
      tryToFixMissingStopId: true,
    };

    return storeTripUpdateFeed(this.name, resp.data, gtfsRTFeedProcessorConfig);
  }
}
