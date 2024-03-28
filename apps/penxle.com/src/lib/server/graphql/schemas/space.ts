import dayjs from 'dayjs';
import { and, count, desc, eq, inArray, isNotNull, notExists } from 'drizzle-orm';
import { match } from 'ts-pattern';
import { SpaceMemberRole, SpaceVisibility } from '$lib/enums';
import { FormValidationError, IntentionalError, NotFoundError, PermissionDeniedError } from '$lib/errors';
import {
  database,
  PostRevisions,
  Posts,
  PostTags,
  Profiles,
  SpaceCollections,
  SpaceFollows,
  SpaceMasquerades,
  SpaceMembers,
  Spaces,
  Users,
  UserSpaceMutes,
  UserTagMutes,
} from '$lib/server/database';
import {
  createNotification,
  createRandomIcon,
  directUploadImage,
  getSpaceMember,
  makeMasquerade,
} from '$lib/server/utils';
import { CreateSpaceSchema, UpdateSpaceSchema } from '$lib/validations';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { SpaceCollection } from './collection';
import { Image } from './image';
import { Post } from './post';
import { Profile } from './user';

/**
 * * Types
 */

export const Space = createObjectRef('Space', Spaces);
Space.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    slug: t.exposeString('slug'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    visibility: t.expose('visibility', { type: SpaceVisibility }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),

    icon: t.field({
      type: Image,
      resolve: (space) => space.iconId,
    }),

    followed: t.boolean({
      resolve: async (space, _, context) => {
        if (!context.session) {
          return false;
        }

        const follows = await database
          .select({ id: SpaceFollows.id })
          .from(SpaceFollows)
          .where(and(eq(SpaceFollows.userId, context.session.userId), eq(SpaceFollows.spaceId, space.id)));

        return follows.length > 0;
      },
    }),

    muted: t.boolean({
      resolve: async (space, _, context) => {
        if (!context.session) {
          return false;
        }

        const mutes = await database
          .select({ id: UserSpaceMutes.id })
          .from(UserSpaceMutes)
          .where(and(eq(UserSpaceMutes.userId, context.session.userId), eq(UserSpaceMutes.spaceId, space.id)));

        return mutes.length > 0;
      },
    }),

    meAsMember: t.field({
      type: SpaceMember,
      nullable: true,
      resolve: async (space, _, context) => {
        if (!context.session) {
          return null;
        }

        const members = await database
          .select({ id: SpaceMembers.id })
          .from(SpaceMembers)
          .where(
            and(
              eq(SpaceMembers.spaceId, space.id),
              eq(SpaceMembers.userId, context.session.userId),
              eq(SpaceMembers.state, 'ACTIVE'),
            ),
          );

        if (members.length === 0) {
          return null;
        }

        return members[0].id;
      },
    }),

    members: t.field({
      type: [SpaceMember],
      resolve: async (space) => {
        const members = await database
          .select({ id: SpaceMembers.id })
          .from(SpaceMembers)
          .where(and(eq(SpaceMembers.spaceId, space.id), eq(SpaceMembers.state, 'ACTIVE')));

        return members.map((member) => member.id);
      },
    }),

    posts: t.field({
      type: [Post],
      args: { mine: t.arg.boolean({ defaultValue: false }) },
      resolve: async (space, args, context) => {
        const meAsMember = await getSpaceMember(context, space.id);
        if (args.mine && !meAsMember) {
          throw new PermissionDeniedError();
        }

        const posts = await database
          .select({ id: Posts.id })
          .from(Posts)
          .where(
            and(
              eq(Posts.spaceId, space.id),
              eq(Posts.state, 'PUBLISHED'),
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              args.mine ? eq(Posts.userId, meAsMember!.id) : undefined,
              meAsMember ? undefined : eq(Posts.visibility, 'PUBLIC'),
              context.session && !meAsMember
                ? notExists(
                    database
                      .select({ id: PostTags.id })
                      .from(PostTags)
                      .innerJoin(UserTagMutes, eq(UserTagMutes.tagId, PostTags.tagId))
                      .where(and(eq(PostTags.postId, Posts.id), eq(UserTagMutes.userId, context.session.userId))),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(Posts.publishedAt));

        return posts.map((post) => post.id);
      },
    }),

    collections: t.field({
      type: [SpaceCollection],
      resolve: async (space) => {
        const collections = await database
          .select({ id: SpaceCollections.id })
          .from(SpaceCollections)
          .where(and(eq(SpaceCollections.spaceId, space.id), eq(SpaceCollections.state, 'ACTIVE')))
          .orderBy(desc(SpaceCollections.createdAt));

        return collections.map((collection) => collection.id);
      },
    }),

    postCount: t.int({
      resolve: async (space) => {
        const [{ value }] = await database
          .select({ value: count() })
          .from(Posts)
          .where(and(eq(Posts.spaceId, space.id), eq(Posts.state, 'PUBLISHED')));

        return value;
      },
    }),

    followerCount: t.int({
      resolve: async (space) => {
        const [{ value }] = await database
          .select({ value: count() })
          .from(SpaceFollows)
          .innerJoin(Users, eq(Users.id, SpaceFollows.userId))
          .where(and(eq(SpaceFollows.spaceId, space.id), eq(Users.state, 'ACTIVE')));

        return value;
      },
    }),

    myMasquerade: t.field({
      type: SpaceMasquerade,
      nullable: true,
      resolve: async (space, _, context) => {
        if (!context.session) {
          return null;
        }

        const masquerades = await database
          .select({ id: SpaceMasquerades.id })
          .from(SpaceMasquerades)
          .where(and(eq(SpaceMasquerades.spaceId, space.id), eq(SpaceMasquerades.userId, context.session.userId)));

        if (masquerades.length === 0) {
          return null;
        }

        return masquerades[0].id;
      },
    }),

    blockedMasquerades: t.field({
      type: [SpaceMasquerade],
      resolve: async (space) => {
        const masquerades = await database
          .select({ id: SpaceMasquerades.id })
          .from(SpaceMasquerades)
          .where(and(eq(SpaceMasquerades.spaceId, space.id), isNotNull(SpaceMasquerades.blockedAt)));

        return masquerades.map((masquerade) => masquerade.id);
      },
    }),

    commentProfile: t.field({
      type: Profile,
      nullable: true,
      resolve: async (space, _, context) => {
        if (!context.session) {
          return null;
        }

        const meAsMember = await getSpaceMember(context, space.id);

        if (meAsMember) {
          return meAsMember.profileId;
        }

        const masquerade = await makeMasquerade({
          spaceId: space.id,
          userId: context.session.userId,
        });

        return masquerade.blockedAt ? null : masquerade.profileId;
      },
    }),
  }),
});

export const SpaceMember = createObjectRef('SpaceMember', SpaceMembers);
SpaceMember.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    role: t.expose('role', { type: SpaceMemberRole }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),

    profile: t.field({
      type: Profile,
      resolve: (member) => member.profileId,
    }),
  }),
});

export const SpaceMasquerade = createObjectRef('SpaceMasquerade', SpaceMasquerades);
SpaceMasquerade.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    blockedAt: t.expose('blockedAt', { type: 'DateTime', nullable: true }),

    profile: t.field({
      type: Profile,
      resolve: (masquerade) => masquerade.profileId,
    }),

    blocked: t.boolean({
      resolve: (masquerade) => !!masquerade.blockedAt,
    }),
  }),
});

/**
 * * Inputs
 */

const CreateSpaceInput = builder.inputType('CreateSpaceInput', {
  fields: (t) => ({
    name: t.string(),
    slug: t.string(),
    iconId: t.id({ required: false }),
    profileName: t.string({ required: false }),
    profileAvatarId: t.id({ required: false }),
    isPublic: t.boolean({ defaultValue: true }),
  }),
  validate: { schema: CreateSpaceSchema },
});

const DeleteSpaceInput = builder.inputType('DeleteSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const UpdateSpaceInput = builder.inputType('UpdateSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
    name: t.string({ required: false }),
    slug: t.string({ required: false }),
    iconId: t.id({ required: false }),
    description: t.string({ required: false }),
    isPublic: t.boolean({ required: false }),
  }),
  validate: { schema: UpdateSpaceSchema },
});

const UpdateSpaceProfileInput = builder.inputType('UpdateSpaceProfileInput', {
  fields: (t) => ({
    spaceId: t.id(),
    profileName: t.string(),
    profileAvatarId: t.id(),
  }),
});

const DeleteSpaceProfileInput = builder.inputType('DeleteSpaceProfileInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const FollowSpaceInput = builder.inputType('FollowSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const UnfollowSpaceInput = builder.inputType('UnfollowSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const MuteSpaceInput = builder.inputType('MuteSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const UnmuteSpaceInput = builder.inputType('UnmuteSpaceInput', {
  fields: (t) => ({
    spaceId: t.id(),
  }),
});

const BlockMasqueradeInput = builder.inputType('BlockMasqueradeInput', {
  fields: (t) => ({
    spaceId: t.id(),
    masqueradeId: t.id(),
  }),
});

const UnblockMasqueradeInput = builder.inputType('UnblockMasqueradeInput', {
  fields: (t) => ({
    spaceId: t.id(),
    masqueradeId: t.id(),
  }),
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  space: t.field({
    type: Space,
    args: { slug: t.arg.string() },
    resolve: async (_, args, context) => {
      const spaces = await database
        .select({ id: Spaces.id, visibility: Spaces.visibility })
        .from(Spaces)
        .where(and(eq(Spaces.slug, args.slug), eq(Spaces.state, 'ACTIVE')));

      if (spaces.length === 0) {
        throw new NotFoundError();
      }

      const [space] = spaces;

      if (space.visibility === 'PRIVATE') {
        if (!context.session) {
          throw new PermissionDeniedError();
        }

        const meAsMember = await getSpaceMember(context, space.id);

        if (!meAsMember) {
          throw new PermissionDeniedError();
        }
      }

      return space.id;
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  createSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: CreateSpaceInput }) },
    resolve: async (_, { input }, context) => {
      const slugUsages = await database
        .select({ id: Spaces.id })
        .from(Spaces)
        .where(and(eq(Spaces.slug, input.slug), eq(Spaces.state, 'ACTIVE')));

      if (slugUsages.length > 0) {
        throw new FormValidationError('slug', '이미 사용중인 URL이에요.');
      }

      return await database.transaction(async (tx) => {
        let profileId: string;

        if (input.profileName && input.profileAvatarId) {
          const [profile] = await tx
            .insert(Profiles)
            .values({ name: input.profileName, avatarId: input.profileAvatarId })
            .returning({ id: Profiles.id });

          profileId = profile.id;
        } else {
          const users = await database
            .select({ profileId: Users.profileId })
            .from(Users)
            .where(eq(Users.id, context.session.userId));

          profileId = users[0].profileId;
        }

        let iconId = input.iconId;
        if (!iconId) {
          iconId = await directUploadImage({
            userId: context.session.userId,
            name: 'icon',
            source: await createRandomIcon(),
          });
        }

        const [space] = await tx
          .insert(Spaces)
          .values({
            name: input.name,
            slug: input.slug,
            state: 'ACTIVE',
            visibility: input.isPublic ? 'PUBLIC' : 'PRIVATE',
            iconId,
          })
          .returning({ id: Spaces.id });

        await tx.insert(SpaceMembers).values({
          spaceId: space.id,
          userId: context.session.userId,
          profileId,
          role: 'ADMIN',
          state: 'ACTIVE',
        });

        return space.id;
      });
    },
  }),

  deleteSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: DeleteSpaceInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (meAsMember?.role !== 'ADMIN') {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        await tx
          .update(SpaceMembers)
          .set({ state: 'INACTIVE' })
          .where(and(eq(SpaceMembers.spaceId, input.spaceId), eq(SpaceMembers.state, 'ACTIVE')));

        const postIds$ = database
          .select({ id: Posts.id })
          .from(Posts)
          .where(and(eq(Posts.spaceId, input.spaceId), eq(Posts.state, 'PUBLISHED')));

        await tx
          .update(PostRevisions)
          .set({ kind: 'ARCHIVED' })
          .where(and(eq(PostRevisions.kind, 'PUBLISHED'), inArray(PostRevisions.postId, postIds$)));

        await tx.update(Posts).set({ state: 'DELETED' }).where(inArray(Posts.id, postIds$));

        await tx.update(Spaces).set({ state: 'INACTIVE' }).where(eq(Spaces.id, input.spaceId));
      });

      return input.spaceId;
    },
  }),

  updateSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: UpdateSpaceInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (meAsMember?.role !== 'ADMIN') {
        throw new PermissionDeniedError();
      }

      if (input.slug) {
        const slugUsages = await database
          .select({ id: Spaces.id })
          .from(Spaces)
          .where(and(eq(Spaces.slug, input.slug), eq(Spaces.state, 'ACTIVE')));

        if (slugUsages.length > 0) {
          throw new IntentionalError('이미 사용중인 URL이에요.');
        }
      }

      await database
        .update(Spaces)
        .set({
          name: input.name ?? undefined,
          slug: input.slug ?? undefined,
          iconId: input.iconId ?? undefined,
          description: input.description ?? undefined,
          visibility: match(input.isPublic)
            .with(true, () => 'PUBLIC' as const)
            .with(false, () => 'PRIVATE' as const)
            .otherwise(() => undefined),
        })
        .where(eq(Spaces.id, input.spaceId));

      return input.spaceId;
    },
  }),

  updateSpaceProfile: t.withAuth({ user: true }).field({
    type: SpaceMember,
    args: { input: t.arg({ type: UpdateSpaceProfileInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        if (meAsMember.profileId === context.session.profileId) {
          const [profile] = await tx
            .insert(Profiles)
            .values({
              name: input.profileName,
              avatarId: input.profileAvatarId,
            })
            .returning({ id: Profiles.id });

          await tx.update(SpaceMembers).set({ profileId: profile.id }).where(eq(SpaceMembers.id, meAsMember.id));
        } else {
          await tx
            .update(Profiles)
            .set({ name: input.profileName, avatarId: input.profileAvatarId })
            .where(eq(Profiles.id, meAsMember.profileId));
        }
      });

      return meAsMember.id;
    },
  }),

  deleteSpaceProfile: t.withAuth({ user: true }).field({
    type: SpaceMember,
    args: { input: t.arg({ type: DeleteSpaceProfileInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      await database
        .update(SpaceMembers)
        .set({ profileId: context.session.profileId })
        .where(eq(SpaceMembers.id, meAsMember.id));

      return meAsMember.id;
    },
  }),

  followSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: FollowSpaceInput }) },
    resolve: async (_, { input }, context) => {
      const spaces = await database
        .select({ id: Spaces.id, visibility: Spaces.visibility })
        .from(Spaces)
        .where(and(eq(Spaces.id, input.spaceId), eq(Spaces.state, 'ACTIVE')));

      if (spaces.length === 0) {
        throw new NotFoundError();
      }

      if (spaces[0].visibility === 'PRIVATE') {
        const meAsMember = await getSpaceMember(context, input.spaceId);

        if (!meAsMember) {
          throw new PermissionDeniedError();
        }
      }

      await database
        .insert(SpaceFollows)
        .values({ userId: context.session.userId, spaceId: input.spaceId })
        .onConflictDoNothing();

      const masquerade = await makeMasquerade({
        spaceId: input.spaceId,
        userId: context.session.userId,
      });

      const members = await database
        .select({ userId: SpaceMembers.userId })
        .from(SpaceMembers)
        .where(and(eq(SpaceMembers.spaceId, input.spaceId), eq(SpaceMembers.state, 'ACTIVE')));

      await Promise.all(
        members.map((member) =>
          createNotification({
            userId: member.userId,
            category: 'SUBSCRIBE',
            actorId: masquerade.profileId,
            data: { spaceId: input.spaceId },
            origin: context.event.url.origin,
          }),
        ),
      );

      return input.spaceId;
    },
  }),

  unfollowSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: UnfollowSpaceInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(SpaceFollows)
        .where(and(eq(SpaceFollows.userId, context.session.userId), eq(SpaceFollows.spaceId, input.spaceId)));

      return input.spaceId;
    },
  }),

  muteSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: MuteSpaceInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .insert(UserSpaceMutes)
        .values({ userId: context.session.userId, spaceId: input.spaceId })
        .onConflictDoNothing();

      return input.spaceId;
    },
  }),

  unmuteSpace: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: UnmuteSpaceInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(UserSpaceMutes)
        .where(and(eq(UserSpaceMutes.userId, context.session.userId), eq(UserSpaceMutes.spaceId, input.spaceId)));

      return input.spaceId;
    },
  }),

  blockMasquerade: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: BlockMasqueradeInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (meAsMember?.role !== 'ADMIN') {
        throw new PermissionDeniedError();
      }

      await database
        .update(SpaceMasquerades)
        .set({ blockedAt: dayjs() })
        .where(and(eq(SpaceMasquerades.id, input.masqueradeId), eq(SpaceMasquerades.spaceId, input.spaceId)));

      return input.spaceId;
    },
  }),

  unblockMasquerade: t.withAuth({ user: true }).field({
    type: Space,
    args: { input: t.arg({ type: UnblockMasqueradeInput }) },
    resolve: async (_, { input }, context) => {
      const meAsMember = await getSpaceMember(context, input.spaceId);

      if (meAsMember?.role !== 'ADMIN') {
        throw new PermissionDeniedError();
      }

      await database
        .update(SpaceMasquerades)
        .set({ blockedAt: null })
        .where(and(eq(SpaceMasquerades.id, input.masqueradeId), eq(SpaceMasquerades.spaceId, input.spaceId)));

      return input.spaceId;
    },
  }),
}));
