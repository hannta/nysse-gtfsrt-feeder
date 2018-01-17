import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { DataProvider } from './index';

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
    console.log('ping!');
    return 0;
  }
}
