import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { DataProvider } from './index';
import { storeTripUpdateFeed } from './../lib/gtfsRTFeedProcessor';

export class OuluProvider implements DataProvider {
  public name = 'oulu';

  public updateInterval = config.oulu.gtfsrtTripUpdatesInterval;

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: config.oulu.gtfsrtTripUpdatesUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    storeTripUpdateFeed(this.name, resp.data);
    console.log('ping!');
    return 0;
  }
}
