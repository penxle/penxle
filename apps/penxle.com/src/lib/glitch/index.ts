import { createClient } from '@penxle/glitch';
import { AppError } from '$lib/errors';
import { keys } from './keys';
import { optimistic } from './optimistic';
import { updates } from './updates';

// eslint-disable-next-line import/no-default-export
export default createClient({
  url: '/api/graphql',
  cache: { keys, optimistic, updates },
  transformError: AppError.deserialize,
  onMutationError: (error) => {
    console.log(error);
  },
});
