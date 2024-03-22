import { eq } from 'drizzle-orm';
import { database, Embeds } from '$lib/server/database';
import { iframely } from '$lib/server/external-api';
import { builder } from '../builder';
import { createObjectRef } from '../utils';

/**
 * * Types
 */

export const Embed = createObjectRef('Embed', Embeds);
Embed.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    type: t.exposeString('type'),
    url: t.exposeString('url'),
    title: t.exposeString('title', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    thumbnailUrl: t.exposeString('thumbnailUrl', { nullable: true }),
    html: t.exposeString('html', { nullable: true }),
  }),
});

/**
 * * Inputs
 */

const UnfurlEmbedInput = builder.inputType('UnfurlEmbedInput', {
  fields: (t) => ({
    url: t.string(),
  }),
});

/**
 * * Queries
 */

// builder.queryFields((t) => ({
// }));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  unfurlEmbed: t.withAuth({ user: true }).field({
    type: Embed,
    nullable: true,
    args: { input: t.arg({ type: UnfurlEmbedInput }) },
    resolve: async (_, { input }) => {
      const embeds = await database.select({ id: Embeds.id }).from(Embeds).where(eq(Embeds.url, input.url));
      if (embeds.length > 0) {
        return embeds[0].id;
      }

      try {
        const meta = await iframely.unfurl(input.url);

        const [embed] = await database
          .insert(Embeds)
          .values({
            type: meta.type,
            url: input.url,
            title: meta.title,
            description: meta.description,
            thumbnailUrl: meta.thumbnailUrl,
            html: meta.html,
          })
          .returning({ id: Embeds.id });

        return embed.id;
      } catch {
        return null;
      }
    },
  }),
}));
