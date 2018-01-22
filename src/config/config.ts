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
  oulu: RegionConfig;
  lahti: RegionConfig;
  tampere: RegionConfig;
  turku: RegionConfig;
  helsinki: RegionConfig;
}

interface RegionConfig {
  feedUrl: string;
  updateInterval: number;
}

const config: ConfigSettings = {
  env: process.env.NODE_ENV || 'development',
  serverPort: parseInt(process.env.SERVER_PORT),
  serverUserAgent: process.env.SERVER_USER_AGENT,
  database: {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    poolConnectionMin: parseInt(process.env.DATABASE_CONNECTION_POOL_MIN),
    poolConnectionMax: parseInt(process.env.DATABASE_CONNECTION_POOL_MAX),
    debug: false,
  },
  oulu: {
    feedUrl: process.env.OULU_GTFSRT_TRIP_UPDATES_URL,
    updateInterval: parseInt(process.env.OULU_UPDATE_INTERVAL),
  },
  lahti: {
    feedUrl: process.env.LAHTI_GTFSRT_TRIP_UPDATES_URL,
    updateInterval: parseInt(process.env.LAHTI_UPDATE_INTERVAL),
  },
  tampere: {
    feedUrl: process.env.TAMPERE_UPDATES_URL,
    updateInterval: parseInt(process.env.TAMPERE_UPDATE_INTERVAL),
  },
  turku: {
    feedUrl: process.env.TURKU_UPDATES_URL,
    updateInterval: parseInt(process.env.TURKU_UPDATE_INTERVAL),
  },
  helsinki: {
    feedUrl: process.env.HELSINKI_UPDATES_URL,
    updateInterval: parseInt(process.env.HELSINKI_UPDATE_INTERVAL),
  },
};

export default config;
