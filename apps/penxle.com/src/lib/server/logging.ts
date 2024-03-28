import { stack } from '@penxle/lib/environment';
import pino from 'pino';

export const logger = pino({
  // level: process.env.SCRIPTS ? 'error' : 'trace',
  level: 'info',
  base: {
    env: stack,
  },
});
