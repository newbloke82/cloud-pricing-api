import createApp from './app';
import config from './config';

createApp().then((app) => {
  app.listen(config.port, '0.0.0.0', () => {
    config.logger.info(
      `🚀  Server ready at http://0.0.0.0:${config.port}${config.pathPrefix}`
    );
  });
});
