import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/tampereSiriFeedProcessor';
import { DataProvider } from '../providers';

export class TampereProvider implements DataProvider {
  public name = 'tampere';

  public updateInterval = parseInt(process.env.TAMPERE_UPDATE_INTERVAL!, 10);

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: process.env.TAMPERE_UPDATES_URL,
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);
    return storeTripUpdateFeed(this.name, resp.data);
  }
}
