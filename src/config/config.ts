require('dotenv').config();

interface ConfigSettings {
  env: string;
  serverPort: number;
  serverUserAgent: string;
  database: {
    host: string;
    user: string;
    password: string;
    database: string;
    poolConnectionMin: number;
    poolConnectionMax: number;
    debug: boolean;
  };
  oulu: {
    gtfsrtTripUpdatesUrl: string;
    gtfsrtTripUpdatesInterval: number;
  };
}

const config: ConfigSettings = {
  env: process.env.NODE_ENV || 'development',
  serverPort: parseInt(process.env.SERVER_PORT),
  serverUserAgent: process.env.SERVER_PORT_USER_AGENT,
  database: {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    poolConnectionMin: parseInt(process.env.DATABASE_CONNECTION_LIMIT_MIN),
    poolConnectionMax: parseInt(process.env.DATABASE_CONNECTION_LIMIT_MAX),
    debug: false,
  },
  oulu: {
    gtfsrtTripUpdatesUrl: process.env.OULU_GTFSRT_TRIP_UPDATES_URL,
    gtfsrtTripUpdatesInterval: 30000,
  },
};

export default config;
