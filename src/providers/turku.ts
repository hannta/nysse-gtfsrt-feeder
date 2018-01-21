import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/turkuSiriFeedProcessor';
import { DataProvider } from '../providers';

export class TurkuProvider implements DataProvider {
  public name = 'turku';
  public updateInterval = config.turku.gtfsrtTripUpdatesInterval;

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: config.turku.gtfsrtTripUpdatesUrl,
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    return storeTripUpdateFeed(this.name, resp.data);
  }
}
