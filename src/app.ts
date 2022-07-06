import express, { Application, Request, Response, NextFunction } from 'express';
import { ApolloServer, ApolloServerExpressConfig } from 'apollo-server-express';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { makeExecutableSchema } from '@graphql-tools/schema';
import pinoHttp from 'pino-http';
import path from 'path';
import { Logger } from 'pino';
import config from './config';
import ApolloLogger from './utils/apolloLogger';
import resolvers from './resolvers';
import typeDefs from './typeDefs';
import health from './health';
import auth from './auth';
import events from './events';
import stats from './stats';
import home from './home';

type ApplicationOptions = {
  apolloConfigOverrides?: ApolloServerExpressConfig;
  disableRequestLogging?: boolean;
  disableStats?: boolean;
  disableAuth?: boolean;
  logger?: Logger;
};

interface ResponseError extends Error {
  status?: number;
}

async function createApp(opts: ApplicationOptions = {}): Promise<Application> {
  const app = express();
  const router = express.Router();

  const logger = opts.logger || config.logger;

  if (!opts.disableRequestLogging) {
    router.use(
      pinoHttp({
        logger,
        customLogLevel(res, err) {
          if (err || res.statusCode === 500) {
            return 'error';
          }
          return 'info';
        },
        autoLogging: {
          ignorePaths: ['/health'],
        },
      })
    );
  }

  if (!opts.disableStats) {
    router.use(express.static(path.join(__dirname, 'public')));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    router.use(home);
  }

  router.use(express.json());
  router.use(
    (err: ResponseError, _req: Request, res: Response, next: NextFunction) => {
      if (err instanceof SyntaxError && err.status === 400) {
        res.status(400).send({ error: 'Bad request' });
      } else {
        next();
      }
    }
  );

  if (!opts.disableRequestLogging) {
    router.use((req: Request, _res: Response, next: NextFunction) => {
      if (!['/health', '/graphql'].includes(req.path)) {
        logger.debug({ body: req.body });
      }
      next();
    });
  }

  router.use(health);

  if (!opts.disableAuth) {
    router.use(auth);
  }

  if (!opts.disableStats) {
    router.use(events);
    router.use(stats);
  }

  const apolloConfig: ApolloServerExpressConfig = {
    schema: makeExecutableSchema({
      typeDefs,
      resolvers,
    }),
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground(),
      () => new ApolloLogger(logger),
    ],
    ...opts.apolloConfigOverrides,
  };

  const apollo = new ApolloServer(apolloConfig);
  await apollo.start();

  apollo.applyMiddleware({ app, path: `${config.pathPrefix}/graphql` });

  app.use(config.pathPrefix, router);

  return app;
}

export default createApp;
