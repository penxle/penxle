import { and, count, desc, eq } from 'drizzle-orm';
import { NotFoundError } from '$lib/errors';
import {
  BookmarkGroupPosts,
  BookmarkGroups,
  database,
  Images,
  Posts,
  SpaceMembers,
  Spaces,
} from '$lib/server/database';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { Image } from './image';
import { Post } from './post';

/**
 * * Types
 */

export const BookmarkGroup = createObjectRef('BookmarkGroup', BookmarkGroups);
BookmarkGroup.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),

    posts: t.field({
      type: [Post],
      resolve: async (bookmarkGroup) => {
        const posts = await database
          .select({ id: Posts.id })
          .from(Posts)
          .innerJoin(BookmarkGroupPosts, eq(Posts.id, BookmarkGroupPosts.postId))
          .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
          .where(
            and(
              eq(BookmarkGroupPosts.bookmarkGroupId, bookmarkGroup.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
            ),
          )
          .orderBy(desc(BookmarkGroupPosts.createdAt));

        return posts.map((post) => post.id);
      },
    }),

    postCount: t.int({
      resolve: async (bookmarkGroup) => {
        const [{ value }] = await database
          .select({ value: count() })
          .from(Posts)
          .innerJoin(BookmarkGroupPosts, eq(Posts.id, BookmarkGroupPosts.postId))
          .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
          .where(
            and(
              eq(BookmarkGroupPosts.bookmarkGroupId, bookmarkGroup.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
            ),
          );

        return value;
      },
    }),

    thumbnails: t.field({
      type: [Image],
      resolve: async (bookmarkGroup) => {
        const sq = database
          .select({ thumbnailId: Posts.thumbnailId, bookmarkedAt: BookmarkGroupPosts.createdAt })
          .from(Posts)
          .innerJoin(BookmarkGroupPosts, eq(Posts.id, BookmarkGroupPosts.postId))
          .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
          .where(
            and(
              eq(BookmarkGroupPosts.bookmarkGroupId, bookmarkGroup.id),
              eq(Posts.state, 'PUBLISHED'),
              eq(Spaces.state, 'ACTIVE'),
            ),
          )
          .orderBy(desc(BookmarkGroupPosts.createdAt))
          .limit(4)
          .as('sq');

        const images = await database
          .select({ id: Images.id })
          .from(Images)
          .innerJoin(sq, eq(Images.id, sq.thumbnailId))
          .orderBy(desc(sq.bookmarkedAt));

        return images.map((image) => image.id);
      },
    }),
  }),
});

export const BookmarkGroupPost = createObjectRef('BookmarkGroupPost', BookmarkGroupPosts);
BookmarkGroupPost.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),

    post: t.field({ type: Post, resolve: (bookmarkPost) => bookmarkPost.postId }),
    bookmarkGroup: t.field({ type: BookmarkGroup, resolve: (bookmarkPost) => bookmarkPost.bookmarkGroupId }),
  }),
});

/**
 * * Inputs
 */

// const CreateBookmarkInput = builder.inputType('CreateBookmarkInput', {
//   fields: (t) => ({
//     name: t.string(),
//   }),
// });

// const DeleteBookmarkInput = builder.inputType('DeleteBookmarkInput', {
//   fields: (t) => ({
//     bookmarkId: t.id(),
//   }),
// });

// const UpdateBookmarkInput = builder.inputType('UpdateBookmarkInput', {
//   fields: (t) => ({
//     bookmarkId: t.id(),
//     name: t.string(),
//   }),
// });

const BookmarkPostInput = builder.inputType('BookmarkPostInput', {
  fields: (t) => ({
    // bookmarkId: t.id(),
    postId: t.id(),
  }),
});

const UnbookmarkPostInput = builder.inputType('UnbookmarkPostInput', {
  fields: (t) => ({
    bookmarkGroupId: t.id(),
    postId: t.id(),
  }),
});

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  bookmarkPost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: BookmarkPostInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ spaceId: Posts.spaceId, visibility: Posts.visibility })
        .from(Posts)
        .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.visibility === 'SPACE') {
        const meAsMembers = await database
          .select({ id: SpaceMembers.id })
          .from(SpaceMembers)
          .where(
            and(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              eq(SpaceMembers.spaceId, post.spaceId!),
              eq(SpaceMembers.userId, context.session.userId),
              eq(SpaceMembers.state, 'ACTIVE'),
            ),
          );

        if (meAsMembers.length === 0) {
          throw new NotFoundError();
        }
      }

      let defaultBookmarkGroups = await database
        .select({ id: BookmarkGroups.id })
        .from(BookmarkGroups)
        .where(eq(BookmarkGroups.userId, context.session.userId))
        .limit(1);

      if (defaultBookmarkGroups.length === 0) {
        defaultBookmarkGroups = await database
          .insert(BookmarkGroups)
          .values({ userId: context.session.userId, name: '북마크' })
          .returning({ id: BookmarkGroups.id });
      }

      const [defaultBookmarkGroup] = defaultBookmarkGroups;

      await database
        .insert(BookmarkGroupPosts)
        .values({ bookmarkGroupId: defaultBookmarkGroup.id, postId: input.postId })
        .onConflictDoNothing();

      return input.postId;
    },
  }),

  unbookmarkPost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: UnbookmarkPostInput }) },
    resolve: async (_, { input }, context) => {
      const bookmarkGroups = database
        .select({ userId: BookmarkGroups.id })
        .from(BookmarkGroups)
        .where(eq(BookmarkGroups.id, input.bookmarkGroupId))
        .as('sq');

      await database
        .delete(BookmarkGroupPosts)
        .where(
          and(
            eq(BookmarkGroupPosts.bookmarkGroupId, input.bookmarkGroupId),
            eq(BookmarkGroupPosts.postId, input.postId),
            eq(bookmarkGroups.userId, context.session.userId),
          ),
        );

      return input.postId;
    },
  }),
}));
