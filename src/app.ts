import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Boom, notFound, boomify } from 'boom';
import winstonInstance from './config/winston';
import config from './config/config';
import { StatusController } from './controllers/status';
import { startDataProviders } from './providers';

class App {
  public express: express.Application;

  constructor() {
    this.express = express();
    this.middleware();
    this.mountRoutes();
    this.errorHandlers();

    startDataProviders();
  }

  public middleware() {
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: false }));
  }

  public errorHandlers() {
    // catch 404 and forward to error handler
    this.express.use((req, res, next) => {
      return next(notFound('API not found'));
    });

    // error handler
    this.express.use(
      (err: Boom, req: express.Request, res: express.Response, next: express.NextFunction) => {
        const convertedError: Boom = err.isBoom ? err : boomify(err);

        winstonInstance.error('Error', convertedError.message, convertedError.output);

        res.status(convertedError.output.statusCode).json({
          error: {
            title: convertedError.output.payload.error,
            message: convertedError.message,
            output: config.env === 'development' ? convertedError.output : undefined,
          },
        });
      },
    );
  }

  public mountRoutes() {
    const router: express.Router = express.Router();

    router.use('/v1/status', new StatusController().router);

    this.express.use('/', router);
  }
}

export default new App().express;
