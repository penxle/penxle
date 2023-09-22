import { createClient } from '@penxle/glitch';
import schema from '$glitch/introspection.json';
import { deserializeGraphQLError } from '$lib/errors';
import { keys } from './keys';
import { updates } from './updates';

// eslint-disable-next-line import/no-default-export
export default createClient({
  url: '/api/graphql',
  cache: { schema, keys, updates },
  onError: deserializeGraphQLError,
});
