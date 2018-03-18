require('dotenv').config(); // tslint:disable-line

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
};

export default config;
