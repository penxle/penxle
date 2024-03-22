import { eq } from 'drizzle-orm';
import { status } from 'itty-router';
import { database, Posts, Spaces } from '$lib/server/database';
import { base36To10 } from '$lib/utils';
import { createRouter } from '../router';
import type { IRequest } from 'itty-router';

export const shortlink = createRouter();

shortlink.get('/shortlink/:shortlink', async (request) => {
  const shortlink = (request as IRequest).params.shortlink;
  if (!shortlink) {
    throw new Error('link is required');
  }

  const permalink = base36To10(shortlink);

  const posts = await database
    .select({ permalink: Posts.permalink, space: { slug: Spaces.slug } })
    .from(Posts)
    .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
    .where(eq(Posts.permalink, permalink));

  if (posts.length === 0) {
    return status(307, { headers: { Location: `/404` } });
  }

  return status(307, {
    headers: {
      Location: `/${posts[0].space.slug}/${posts[0].permalink}`,
    },
  });
});
