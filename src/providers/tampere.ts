import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed } from '../lib/tampereJourneysApiFeedProcessor';
import { DataProvider } from '../providers';

/**
 * Tampere Journeys api provider
 * Fetches data from Tampere journeys api and stores it to database
 */
export class TampereProvider implements DataProvider {
  public regionKey = 'tampere';

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
    return storeTripUpdateFeed(this.regionKey, resp.data);
  }
}
