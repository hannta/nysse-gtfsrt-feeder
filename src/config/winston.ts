import * as winston from 'winston';
import config from './config';

export default new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: config.env === 'development' ? 'debug' : 'warn',
      json: false,
      colorize: false,
    }),
  ],
});
