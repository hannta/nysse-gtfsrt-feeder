import * as winston from 'winston';
import * as moment from 'moment';
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
