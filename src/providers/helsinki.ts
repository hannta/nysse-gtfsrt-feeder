import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class HelsinkiProvider implements DataProvider {
  public name = 'helsinki';

  public updateInterval = config.helsinki.updateInterval;

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: config.helsinki.feedUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    return storeTripUpdateFeed(this.name, resp.data);
  }
}
