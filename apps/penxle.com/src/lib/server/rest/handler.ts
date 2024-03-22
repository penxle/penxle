import { error } from 'itty-router';
import { createContext } from '../context';
import { createRouter } from './router';
import { email, healthz, identification, nolt, notification, opengraph, payment, shortlink, sso } from './routes';
import type { RequestEvent } from '@sveltejs/kit';

const router = createRouter();

router.all(
  '*',
  healthz.handle,
  email.handle,
  identification.handle,
  nolt.handle,
  notification.handle,
  opengraph.handle,
  payment.handle,
  shortlink.handle,
  sso.handle,
  () => error(404),
);

export const handler = async (event: RequestEvent) => {
  const context = await createContext(event);
  return await router.handle(event.request, context);
};
