import axios, { AxiosRequestConfig } from 'axios';
import config from '../config/config';
import { storeTripUpdateFeed, GtfsRTFeedProcessorSettings } from '../lib/gtfsRTFeedProcessor';
import { DataProvider } from '../providers';

export class JyvaskylaProvider implements DataProvider {
  public name = 'jyvaskyla';

  public updateInterval = parseInt(process.env.JYVASKYLA_UPDATE_INTERVAL!, 10);

  public async getTripUpdates() {
    const requestConfig: AxiosRequestConfig = {
      method: 'GET',
      url: process.env.JYVASKYLA_UPDATES_URL,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': config.serverUserAgent,
      },
      timeout: 5000,
    };

    const resp = await axios.request(requestConfig);

    const gtfsRTFeedProcessorSettings: GtfsRTFeedProcessorSettings = {
      getMissingTripFromDB: true,
      tryToFixMissingStopId: true,
    };

    return storeTripUpdateFeed(this.name, resp.data, gtfsRTFeedProcessorSettings);
  }
}
