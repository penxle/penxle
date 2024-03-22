import { and, asc, count, eq, inArray, or } from 'drizzle-orm';
import { NotFoundError, PermissionDeniedError } from '$lib/errors';
import { database, Posts, SpaceCollectionPosts, SpaceCollections } from '$lib/server/database';
import { getSpaceMember } from '$lib/server/utils';
import { CreateSpaceCollectionSchema, UpdateSpaceCollectionSchema } from '$lib/validations';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { Image } from './image';
import { Post } from './post';

/**
 * * Types
 */

export const SpaceCollection = createObjectRef('SpaceCollection', SpaceCollections);
SpaceCollection.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),

    thumbnail: t.field({
      type: Image,
      nullable: true,
      resolve: (spaceCollection) => spaceCollection.thumbnailId,
    }),

    posts: t.field({
      type: [Post],
      resolve: async (spaceCollection, _, context) => {
        const meAsMember = await getSpaceMember(context, spaceCollection.spaceId);

        const posts = await database
          .select({ id: Posts.id })
          .from(Posts)
          .innerJoin(SpaceCollectionPosts, eq(Posts.id, SpaceCollectionPosts.postId))
          .where(
            and(
              eq(SpaceCollectionPosts.collectionId, spaceCollection.id),
              eq(Posts.state, 'PUBLISHED'),
              meAsMember ? undefined : eq(Posts.visibility, 'PUBLIC'),
            ),
          )
          .orderBy(asc(SpaceCollectionPosts.order));

        return posts.map((post) => post.id);
      },
    }),

    count: t.int({
      resolve: async (spaceCollection, _, context) => {
        const meAsMember = await getSpaceMember(context, spaceCollection.spaceId);

        const [{ value }] = await database
          .select({ value: count() })
          .from(Posts)
          .innerJoin(SpaceCollectionPosts, eq(Posts.id, SpaceCollectionPosts.postId))
          .where(
            and(
              eq(SpaceCollectionPosts.collectionId, spaceCollection.id),
              eq(Posts.state, 'PUBLISHED'),
              meAsMember ? undefined : eq(Posts.visibility, 'PUBLIC'),
            ),
          );

        return value;
      },
    }),
  }),
});

export const SpaceCollectionPost = createObjectRef('SpaceCollectionPost', SpaceCollectionPosts);
SpaceCollectionPost.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    order: t.exposeInt('order'),

    post: t.field({
      type: Post,
      resolve: (spaceCollectionPost) => spaceCollectionPost.postId,
    }),
  }),
});

/**
 * * Inputs
 */

const CreateSpaceCollectionInput = builder.inputType('CreateSpaceCollectionInput', {
  fields: (t) => ({
    spaceId: t.id(),
    name: t.string(),
  }),
  validate: { schema: CreateSpaceCollectionSchema },
});

const DeleteSpaceCollectionInput = builder.inputType('DeleteSpaceCollectionInput', {
  fields: (t) => ({
    spaceCollectionId: t.id(),
  }),
});

const SetSpaceCollectionPostsInput = builder.inputType('SetSpaceCollectionPostsInput', {
  fields: (t) => ({
    spaceCollectionId: t.id(),
    postIds: t.idList(),
  }),
});

const UpdateSpaceCollectionInput = builder.inputType('UpdateSpaceCollectionInput', {
  fields: (t) => ({
    spaceCollectionId: t.id(),
    name: t.string(),
    thumbnailId: t.id({ required: false }),
  }),
  validate: { schema: UpdateSpaceCollectionSchema },
});

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  createSpaceCollection: t.withAuth({ user: true }).field({
    type: SpaceCollection,
    args: { input: t.arg({ type: CreateSpaceCollectionInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);
      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      const [collection] = await database
        .insert(SpaceCollections)
        .values({ spaceId: input.spaceId, name: input.name, state: 'ACTIVE' })
        .returning({ id: SpaceCollections.id });

      return collection.id;
    },
  }),

  deleteSpaceCollection: t.withAuth({ user: true }).field({
    type: SpaceCollection,
    args: { input: t.arg({ type: DeleteSpaceCollectionInput }) },
    resolve: async (_, { input }, context) => {
      const spaceCollections = await database
        .select({ spaceId: SpaceCollections.spaceId })
        .from(SpaceCollections)
        .where(eq(SpaceCollections.id, input.spaceCollectionId));

      if (spaceCollections.length === 0) {
        throw new NotFoundError();
      }

      const meAsMember = await getSpaceMember(context, spaceCollections[0].spaceId);
      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        await tx
          .update(SpaceCollections)
          .set({ state: 'INACTIVE' })
          .where(eq(SpaceCollections.id, input.spaceCollectionId));

        await tx.delete(SpaceCollectionPosts).where(eq(SpaceCollectionPosts.collectionId, input.spaceCollectionId));
      });

      return input.spaceCollectionId;
    },
  }),

  updateSpaceCollection: t.withAuth({ user: true }).field({
    type: SpaceCollection,
    args: { input: t.arg({ type: UpdateSpaceCollectionInput }) },
    resolve: async (_, { input }, context) => {
      const spaceCollections = await database
        .select({ spaceId: SpaceCollections.spaceId })
        .from(SpaceCollections)
        .where(and(eq(SpaceCollections.id, input.spaceCollectionId), eq(SpaceCollections.state, 'ACTIVE')));

      if (spaceCollections.length === 0) {
        throw new NotFoundError();
      }

      const meAsMember = await getSpaceMember(context, spaceCollections[0].spaceId);
      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      await database
        .update(SpaceCollections)
        .set({ name: input.name, thumbnailId: input.thumbnailId ?? null })
        .where(eq(SpaceCollections.id, input.spaceCollectionId));

      return input.spaceCollectionId;
    },
  }),

  setSpaceCollectionPosts: t.withAuth({ user: true }).field({
    type: SpaceCollection,
    args: { input: t.arg({ type: SetSpaceCollectionPostsInput }) },
    resolve: async (_, { input }, context) => {
      const spaceCollections = await database
        .select({ spaceId: SpaceCollections.spaceId })
        .from(SpaceCollections)
        .where(and(eq(SpaceCollections.id, input.spaceCollectionId), eq(SpaceCollections.state, 'ACTIVE')));

      if (spaceCollections.length === 0) {
        throw new NotFoundError();
      }

      const isSpaceMember = await getSpaceMember(context, spaceCollections[0].spaceId);
      if (!isSpaceMember) {
        throw new PermissionDeniedError();
      }

      const [{ validPostCount }] = await database
        .select({ validPostCount: count() })
        .from(Posts)
        .where(
          and(
            inArray(Posts.id, input.postIds),
            eq(Posts.spaceId, spaceCollections[0].spaceId),
            eq(Posts.state, 'PUBLISHED'),
          ),
        );

      if (validPostCount !== input.postIds.length) {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        await tx
          .delete(SpaceCollectionPosts)
          .where(
            or(
              eq(SpaceCollectionPosts.collectionId, input.spaceCollectionId),
              inArray(SpaceCollectionPosts.postId, input.postIds),
            ),
          );

        await tx.insert(SpaceCollectionPosts).values(
          input.postIds.map((postId, order) => ({
            collectionId: input.spaceCollectionId,
            postId,
            order,
          })),
        );
      });

      return input.spaceCollectionId;
    },
  }),
}));
