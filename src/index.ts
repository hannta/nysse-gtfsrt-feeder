import App from './app';
import config from './config/config';

App.listen(config.serverPort, () => {
  console.info(`Server started on port ${config.serverPort} (${config.env})`);
});
