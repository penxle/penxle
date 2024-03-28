import { useGraphQlJit } from '@envelop/graphql-jit';
import { createYoga } from 'graphql-yoga';
import { createContext } from '../context';
import { useErrorHandling, useLogging } from './plugins';
import { schema } from './schemas';
import type { RequestEvent } from '@sveltejs/kit';

const yoga = createYoga<RequestEvent>({
  schema,
  context: createContext,
  fetchAPI: { Response },
  graphqlEndpoint: '/api/graphql',
  batching: true,
  maskedErrors: false,
  plugins: [useGraphQlJit(), useErrorHandling(), useLogging()],
});

export const handler = async (event: RequestEvent) => {
  return await yoga.handleRequest(event.request, event);
};
