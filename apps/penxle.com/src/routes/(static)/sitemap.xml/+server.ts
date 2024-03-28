import { and, asc, eq, isNull } from 'drizzle-orm';
import { create } from 'xmlbuilder2';
import { useCache } from '$lib/server/cache';
import { database, Posts, Spaces } from '$lib/server/database';
import type { RequestHandler } from './$types';

const predefined = ['/'];

export const GET: RequestHandler = async (event) => {
  const paths = await useCache('sitemap.xml', async () => {
    const spaces = await database
      .select({ slug: Spaces.slug })
      .from(Spaces)
      .where(and(eq(Spaces.state, 'ACTIVE'), eq(Spaces.visibility, 'PUBLIC')))
      .orderBy(asc(Spaces.id));

    const posts = await database
      .select({ permalink: Posts.permalink, space: { slug: Spaces.slug } })
      .from(Posts)
      .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
      .where(
        and(
          eq(Posts.state, 'PUBLISHED'),
          eq(Posts.visibility, 'PUBLIC'),
          isNull(Posts.password),
          eq(Posts.externalSearchable, true),
          eq(Spaces.state, 'ACTIVE'),
          eq(Spaces.visibility, 'PUBLIC'),
        ),
      )
      .orderBy(asc(Posts.id));

    return [
      ...predefined,
      ...spaces.map(({ slug }) => `/${slug}`),
      ...posts.map(({ permalink, space }) => `/${space.slug}/${permalink}`),
    ];
  });

  const doc = create({
    urlset: {
      '@xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'url': [paths.map((path) => ({ loc: `${event.url.origin}${path}` }))],
    },
  });

  return new Response(doc.end(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
