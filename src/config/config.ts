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
  kuopio: RegionConfig;
  joensuu: RegionConfig;
  lappeenranta: RegionConfig;
  jyvaskyla: RegionConfig;
}

interface RegionConfig {
  feedUrl: string;
  updateInterval: number;
}

const config: ConfigSettings = {
  env: process.env.NODE_ENV || 'development',
  serverPort: parseInt(process.env.SERVER_PORT || '8888', 10),
  serverUserAgent: process.env.SERVER_USER_AGENT || '',
  database: {
    host: process.env.DATABASE_HOST || '',
    user: process.env.DATABASE_USER || '',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
    poolConnectionMin: parseInt(process.env.DATABASE_CONNECTION_POOL_MIN || '1', 10),
    poolConnectionMax: parseInt(process.env.DATABASE_CONNECTION_POOL_MAX || '1', 10),
    debug: false,
  },
  oulu: {
    feedUrl: process.env.OULU_GTFSRT_TRIP_UPDATES_URL || '',
    updateInterval: parseInt(process.env.OULU_UPDATE_INTERVAL || '15000', 10),
  },
  lahti: {
    feedUrl: process.env.LAHTI_GTFSRT_TRIP_UPDATES_URL || '',
    updateInterval: parseInt(process.env.LAHTI_UPDATE_INTERVAL || '15000', 10),
  },
  tampere: {
    feedUrl: process.env.TAMPERE_UPDATES_URL || '',
    updateInterval: parseInt(process.env.TAMPERE_UPDATE_INTERVAL || '15000', 10),
  },
  turku: {
    feedUrl: process.env.TURKU_UPDATES_URL || '',
    updateInterval: parseInt(process.env.TURKU_UPDATE_INTERVAL || '15000', 10),
  },
  helsinki: {
    feedUrl: process.env.HELSINKI_UPDATES_URL || '',
    updateInterval: parseInt(process.env.HELSINKI_UPDATE_INTERVAL || '15000', 10),
  },
  kuopio: {
    feedUrl: process.env.KUOPIO_UPDATES_URL || '',
    updateInterval: parseInt(process.env.KUOPIO_UPDATE_INTERVAL || '15000', 10),
  },
  joensuu: {
    feedUrl: process.env.JOENSUU_UPDATES_URL || '',
    updateInterval: parseInt(process.env.JOENSUU_UPDATE_INTERVAL || '15000', 10),
  },
  lappeenranta: {
    feedUrl: process.env.LAPPEENRANTA_UPDATES_URL || '',
    updateInterval: parseInt(process.env.LAPPEENRANTA_UPDATE_INTERVAL || '15000', 10),
  },
  jyvaskyla: {
    feedUrl: process.env.JYVASKYLA_UPDATES_URL || '',
    updateInterval: parseInt(process.env.JYVASKYLA_UPDATE_INTERVAL || '15000', 10),
  },
};

export default config;
