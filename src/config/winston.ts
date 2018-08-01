import { createLogger, transports } from 'winston';
import config from './config';

export default createLogger({
  transports: [
    new transports.Console({
      level: config.env === 'development' ? 'debug' : 'warn',
    }),
  ],
});
