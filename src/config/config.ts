require('dotenv').config();

interface ConfigSettings {
  env: string;
  serverPort: number;
  serverUserAgent: string;
}

const config: ConfigSettings = {
  env: process.env.NODE_ENV || 'development',
  serverPort: parseInt(process.env.SERVER_PORT),
  serverUserAgent: process.env.SERVER_PORT_USER_AGENT,
};

export default config;
