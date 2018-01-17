require('dotenv').config();

interface ConfigSettings {
  env: string;
  serverPort: number;
  serverUserAgent: string;
  oulu: {
    gtfsrtTripUpdatesUrl: string;
    gtfsrtTripUpdatesInterval: number;
  };
}

const config: ConfigSettings = {
  env: process.env.NODE_ENV || 'development',
  serverPort: parseInt(process.env.SERVER_PORT),
  serverUserAgent: process.env.SERVER_PORT_USER_AGENT,
  oulu: {
    gtfsrtTripUpdatesUrl: process.env.OULU_GTFSRT_TRIP_UPDATES_URL,
    gtfsrtTripUpdatesInterval: 30000,
  },
};

export default config;
