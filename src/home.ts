import express from 'express';
import config from './config';

const router = express.Router();

router.get('/', (_req, res) => {
  const version = process.env.npm_package_version;

  res.render('pages/home', { pathPrefix: config.pathPrefix, version });
});

export default router;
