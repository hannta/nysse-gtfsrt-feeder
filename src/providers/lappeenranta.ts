import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed, GtfsRTFeedProcessorConfig } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class LappeenrantaProvider implements DataProvider {
  public name = 'lappeenranta';

  public updateInterval = config.lappeenranta.updateInterval;

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: config.lappeenranta.feedUrl,
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
