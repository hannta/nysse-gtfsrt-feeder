import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed, GtfsRTFeedProcessorConfig } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class LahtiProvider implements DataProvider {
  public name = 'lahti';

  public updateInterval = config.lahti.updateInterval;

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: config.lahti.feedUrl,
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
