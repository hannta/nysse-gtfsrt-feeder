import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/turkuSiriFeedProcessor';
import { DataProvider } from '../providers';

/**
 * Turku SIRI provider
 * Fetches data from Turku SIRI api and stores it to database
 */
export class TurkuProvider implements DataProvider {
  public name = 'turku';

  public updateInterval = parseInt(process.env.TURKU_UPDATE_INTERVAL!, 10);

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: process.env.TURKU_UPDATES_URL,
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    return storeTripUpdateFeed(this.name, resp.data);
  }
}
