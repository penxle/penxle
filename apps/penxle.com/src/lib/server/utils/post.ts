import { webcrypto } from 'node:crypto';
import { asc, count, eq } from 'drizzle-orm';
import { useCache } from '$lib/server/cache';
import { database, PostRevisionContents, PostViews, SpaceCollectionPosts } from '../database';
import { isEmptyContent } from './tiptap';
import type { JSONContent } from '@tiptap/core';
import type { Transaction } from '../database';

export const makePostContentId = async (data: JSONContent[] | null) => {
  if (isEmptyContent(data)) {
    return null;
  }

  const hash = Buffer.from(
    await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data))),
  ).toString('hex');

  const [content] = await database
    .insert(PostRevisionContents)
    .values({ hash, data })
    .onConflictDoNothing()
    .returning({ id: PostRevisionContents.id });

  return content.id;
};

export const getPostViewCount = (postId: string) =>
  useCache(
    `Post:${postId}:viewCount`,
    async () => {
      const [{ value }] = await database.select({ value: count() }).from(PostViews).where(eq(PostViews.postId, postId));
      return value;
    },
    365 * 24 * 60 * 60,
  );

export const defragmentSpaceCollectionPosts = async (tx: Transaction, collectionId: string) => {
  const posts = await tx
    .select({ id: SpaceCollectionPosts.id })
    .from(SpaceCollectionPosts)
    .where(eq(SpaceCollectionPosts.collectionId, collectionId))
    .orderBy(asc(SpaceCollectionPosts.order));

  for (const [order, { id }] of posts.entries()) {
    await tx.update(SpaceCollectionPosts).set({ order }).where(eq(SpaceCollectionPosts.id, id));
  }
};
