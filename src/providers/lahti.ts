import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class LahtiProvider implements DataProvider {
  public name = 'lahti';

  public updateInterval = config.lahti.updateInterval;

  public async getTripUpdates() {
    const requestParams = {
      method: 'GET',
      url: config.lahti.feedUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestParams);
    return storeTripUpdateFeed(this.name, resp.data);
  }
}
