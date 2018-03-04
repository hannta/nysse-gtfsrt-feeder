import App from './app';
import winstonInstance from './config/winston';
import config from './config/config';

App.listen(config.serverPort, () => {
  winstonInstance.info(`Server started on port ${config.serverPort} (${config.env})`);
});
