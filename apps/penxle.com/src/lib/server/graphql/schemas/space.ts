import * as R from 'radash';
import { match } from 'ts-pattern';
import { FormValidationError, IntentionalError, NotFoundError, PermissionDeniedError } from '$lib/errors';
import {
  createNotification,
  createRandomIcon,
  directUploadImage,
  indexPostByQuery,
  indexSpace,
  Loader,
  makeMasquerade,
} from '$lib/server/utils';
import { createId } from '$lib/utils';
import {
  AcceptSpaceMemberInvitationSchema,
  CreateSpaceMemberInvitationSchema,
  CreateSpaceSchema,
  UpdateSpaceSchema,
} from '$lib/validations';
import { PrismaEnums } from '$prisma';
import { defineSchema } from '../builder';

export const spaceSchema = defineSchema((builder) => {
  /**
   * * Types
   */

  builder.prismaObject('Space', {
    grantScopes: async (space, { db, ...context }) => {
      if (!context.session) {
        return [];
      }

      const spaceMemberLoader = Loader.spaceMember({ db, context });
      const member = await spaceMemberLoader.load(space.id);

      if (!member) {
        return [];
      }

      return R.sift(['$space:member', member.role === 'ADMIN' && '$space:admin']);
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      slug: t.exposeString('slug'),
      name: t.exposeString('name'),
      description: t.exposeString('description', { nullable: true }),
      icon: t.relation('icon'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),

      followed: t.boolean({
        resolve: async (space, _, { db, ...context }) => {
          if (!context.session) {
            return false;
          }

          return await db.spaceFollow.existsUnique({
            where: {
              userId_spaceId: {
                userId: context.session.userId,
                spaceId: space.id,
              },
            },
          });
        },
      }),

      meAsMember: t.prismaField({
        type: 'SpaceMember',
        nullable: true,
        resolve: async (query, space, __, { db, ...context }) => {
          if (!context.session) {
            return null;
          }

          return await db.spaceMember.findUnique({
            ...query,
            where: {
              spaceId_userId: {
                spaceId: space.id,
                userId: context.session.userId,
              },
              state: 'ACTIVE',
            },
          });
        },
      }),

      members: t.relation('members', {
        query: { where: { state: 'ACTIVE' } },
      }),

      invitations: t.relation('invitations', {
        authScopes: { $granted: '$space:admin' },
        // @ts-expect-error pothos-prisma가 unauthorizedResolver 리턴값 타입 추론을 잘못하는듯
        unauthorizedResolver: () => [],
        grantScopes: ['$space.member.invitation'],
      }),

      posts: t.prismaField({
        type: ['Post'],
        args: { mine: t.arg.boolean({ defaultValue: false }) },
        resolve: async (query, space, input, { db, ...context }) => {
          const meAsMember = context.session
            ? await db.spaceMember.findUnique({
                where: {
                  spaceId_userId: {
                    spaceId: space.id,
                    userId: context.session.userId,
                  },
                  state: 'ACTIVE',
                },
              })
            : null;

          if (input.mine && !meAsMember) {
            return [];
          }

          return await db.post.findMany({
            ...query,
            where: {
              spaceId: space.id,
              state: 'PUBLISHED',
              // input.mine이 true인데 meAsMember가 null이면 위에서 return되서 여기까지 안옴
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              memberId: input.mine ? meAsMember!.id : undefined,
              visibility: meAsMember ? undefined : 'PUBLIC',
              tags:
                context.session && !meAsMember
                  ? {
                      none: {
                        tag: { userMutes: { some: { userId: context.session.userId } } },
                      },
                    }
                  : undefined,
            },
            orderBy: { publishedAt: 'desc' },
          });
        },
      }),

      visibility: t.expose('visibility', { type: PrismaEnums.SpaceVisibility }),
      externalLinks: t.relation('externalLinks'),

      muted: t.field({
        type: 'Boolean',
        resolve: async (space, _, { db, ...context }) => {
          if (!context.session) {
            return false;
          }

          return db.userSpaceMute.existsUnique({
            where: {
              userId_spaceId: {
                userId: context.session.userId,
                spaceId: space.id,
              },
            },
          });
        },
      }),

      collections: t.relation('collections', {
        query: { where: { state: 'ACTIVE' } },
      }),

      postCount: t.relationCount('posts', { where: { state: 'PUBLISHED' } }),
      followerCount: t.relationCount('followers', { where: { user: { state: 'ACTIVE' } } }),

      myMasquerade: t.prismaField({
        type: 'SpaceMasquerade',
        nullable: true,
        select: (_, context, nestedSelection) => {
          if (context.session) {
            return {
              masquerades: nestedSelection({
                where: { userId: context.session.userId },
              }),
            };
          }
          return {};
        },
        resolve: async (_, space, __, context) => {
          if (!context.session) {
            return null;
          }

          return space.masquerades[0];
        },
      }),

      blockedMasquerades: t.relation('masquerades', {
        authScopes: { $granted: '$space:admin' },
        grantScopes: ['$spaceMasquerade:spaceAdmin'],
        query: {
          where: {
            blockedAt: { not: null },
          },
        },
      }),

      commentProfile: t.prismaField({
        type: 'Profile',
        nullable: true,
        resolve: async (query, space, __, { db, ...context }) => {
          if (!context.session) {
            return null;
          }

          const meAsMember = await db.spaceMember.findUnique({
            select: { profile: query },
            where: {
              spaceId_userId: {
                spaceId: space.id,
                userId: context.session.userId,
              },
              state: 'ACTIVE',
            },
          });

          if (meAsMember) {
            return meAsMember.profile;
          }

          const masquerade = await makeMasquerade({
            db,
            spaceId: space.id,
            userId: context.session.userId,
            query: {
              include: { profile: query },
            },
          });

          return masquerade.blockedAt ? null : masquerade.profile;
        },
      }),
    }),
  });

  builder.prismaObject('SpaceMember', {
    grantScopes: async (member, { db, ...context }) => {
      if (!context.session) {
        return [];
      }

      const spaceMemberLoader = Loader.spaceMember({ db, context });
      const meAsMember = await spaceMemberLoader.load(member.spaceId);

      if (!meAsMember) {
        return [];
      }

      return R.sift(['$space:member', meAsMember.role === 'ADMIN' && '$space:admin']);
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      role: t.expose('role', { type: PrismaEnums.SpaceMemberRole }),
      profile: t.relation('profile'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      email: t.string({
        authScopes: { $granted: '$space:member' },
        resolve: async (member, _, { db }) => {
          const user = await db.user.findUniqueOrThrow({
            where: { id: member.userId },
          });

          return user?.email;
        },
      }),
    }),
  });

  builder.prismaObject('SpaceMemberInvitation', {
    authScopes: { $granted: '$space.member.invitation' },
    fields: (t) => ({
      id: t.exposeID('id'),
      receivedEmail: t.exposeString('receivedEmail'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      state: t.field({
        type: PrismaEnums.SpaceMemberInvitationState,
        authScopes: { $granted: '$space.member.invitation.state' },
        resolve: (invitation) => invitation.state,
        unauthorizedResolver: (invitation) =>
          ['PENDING', 'ACCEPTED'].includes(invitation.state) ? invitation.state : 'PENDING',
      }),
      space: t.relation('space'),
      respondedAt: t.expose('respondedAt', {
        type: 'DateTime',
        nullable: true,
      }),
    }),
  });

  builder.prismaObject('SpaceExternalLink', {
    fields: (t) => ({
      id: t.exposeID('id'),
      url: t.exposeString('url'),
    }),
  });

  builder.prismaObject('SpaceMasquerade', {
    fields: (t) => ({
      id: t.exposeID('id'),
      profile: t.relation('profile'),
      blockedAt: t.expose('blockedAt', {
        authScopes: { $granted: '$spaceMasquerade:spaceAdmin' },
        type: 'DateTime',
        nullable: true,
      }),

      blocked: t.field({
        type: 'Boolean',
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
      externalLinks: t.stringList({ required: false }),
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

  const CreateSpaceMemberInvitationInput = builder.inputType('CreateSpaceMemberInvitationInput', {
    fields: (t) => ({
      spaceId: t.id(),
      email: t.string(),
      role: t.field({ type: PrismaEnums.SpaceMemberRole }),
    }),
    validate: { schema: CreateSpaceMemberInvitationSchema },
  });

  const AcceptSpaceMemberInvitationInput = builder.inputType('AcceptSpaceMemberInvitationInput', {
    fields: (t) => ({
      invitationId: t.id(),
      profileName: t.string({ required: false }),
      profileAvatarId: t.id({ required: false }),
    }),
    validate: { schema: AcceptSpaceMemberInvitationSchema },
  });

  const IgnoreSpaceMemberInvitationInput = builder.inputType('IgnoreSpaceMemberInvitationInput', {
    fields: (t) => ({
      invitationId: t.id(),
    }),
  });

  const LeaveSpaceInput = builder.inputType('LeaveSpaceInput', {
    fields: (t) => ({
      spaceId: t.id(),
    }),
  });

  const RemoveSpaceMemberInput = builder.inputType('RemoveSpaceMemberInput', {
    fields: (t) => ({
      spaceMemberId: t.id(),
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

  const UpdateSpaceMemberRoleInput = builder.inputType('UpdateSpaceMemberRoleInput', {
    fields: (t) => ({
      spaceMemberId: t.id(),
      role: t.field({ type: PrismaEnums.SpaceMemberRole }),
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
    space: t.prismaField({
      type: 'Space',
      args: { slug: t.arg.string() },
      resolve: async (query, _, args, { db, ...context }) => {
        const space = await db.space.findFirst({
          where: { slug: args.slug, state: 'ACTIVE' },
        });

        if (!space) {
          throw new NotFoundError();
        }

        if (space.visibility === 'PRIVATE') {
          if (!context.session) {
            throw new PermissionDeniedError();
          }

          const isMember = await db.spaceMember.existsUnique({
            where: {
              spaceId_userId: {
                spaceId: space.id,
                userId: context.session.userId,
              },
              state: 'ACTIVE',
            },
          });

          if (!isMember) {
            throw new PermissionDeniedError();
          }
        }

        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: space.id },
        });
      },
    }),
  }));

  /**
   * * Mutations
   */

  builder.mutationFields((t) => ({
    createSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: CreateSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const isSlugUsed = await db.space.exists({
          where: { slug: input.slug, state: 'ACTIVE' },
        });

        if (isSlugUsed) {
          throw new FormValidationError('slug', '이미 사용중인 URL이에요.');
        }

        let profileId: string;
        if (input.profileName && input.profileAvatarId) {
          const profile = await db.profile.create({
            data: {
              id: createId(),
              name: input.profileName,
              avatarId: input.profileAvatarId,
            },
          });

          profileId = profile.id;
        } else {
          const user = await db.user.findUniqueOrThrow({
            where: { id: context.session.userId },
          });

          profileId = user.profileId;
        }

        let iconId = input.iconId;
        if (!iconId) {
          iconId = await directUploadImage({
            db,
            userId: context.session.userId,
            name: 'icon',
            source: await createRandomIcon(),
          });
        }

        const spaceId = createId();
        const space = await db.space.create({
          data: {
            id: spaceId,
            name: input.name,
            slug: input.slug,
            state: 'ACTIVE',
            visibility: input.isPublic ? 'PUBLIC' : 'PRIVATE',
            iconId,
            members: {
              create: {
                id: createId(),
                userId: context.session.userId,
                profileId,
                role: 'ADMIN',
                state: 'ACTIVE',
              },
            },
          },
        });

        await indexSpace(space);
        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: spaceId },
        });
      },
    }),

    deleteSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: DeleteSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const space = await db.space.update({
          where: {
            id: input.spaceId,
            state: 'ACTIVE',
            members: { some: { userId: context.session.userId, role: 'ADMIN' } },
          },
          data: {
            state: 'INACTIVE',
            members: {
              updateMany: {
                where: { state: 'ACTIVE' },
                data: { state: 'INACTIVE' },
              },
            },
            posts: {
              updateMany: {
                where: { state: 'PUBLISHED' },
                data: { state: 'DELETED' },
              },
            },
          },
        });

        await db.postRevision.updateMany({
          where: {
            post: { spaceId: input.spaceId },
            kind: 'PUBLISHED',
          },
          data: { kind: 'ARCHIVED' },
        });

        await indexSpace(space);
        await indexPostByQuery({
          db,
          where: { spaceId: input.spaceId },
        });

        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: space.id },
        });
      },
    }),

    createSpaceMemberInvitation: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMemberInvitation',
      grantScopes: ['$space.member.invitation'],
      args: { input: t.arg({ type: CreateSpaceMemberInvitationInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const member = await db.spaceMember.findUniqueOrThrow({
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            role: 'ADMIN',
            state: 'ACTIVE',
          },
        });

        const targetUser = await db.user.findFirst({
          where: { email: input.email.toLowerCase() },
        });

        if (targetUser) {
          const isAlreadyMember = await db.spaceMember.existsUnique({
            where: {
              spaceId_userId: {
                spaceId: input.spaceId,
                userId: targetUser.id,
              },
              state: 'ACTIVE',
            },
          });

          if (isAlreadyMember) {
            throw new FormValidationError('email', '이미 스페이스에 가입한 사용자예요.');
          }
        }

        const isAlreadyInvited = await db.spaceMemberInvitation.exists({
          where: {
            spaceId: input.spaceId,
            receivedEmail: input.email.toLowerCase(),
            state: { not: 'ACCEPTED' },
          },
        });

        if (isAlreadyInvited) {
          throw new FormValidationError('email', '이미 초대한 사용자예요.');
        }

        return await db.spaceMemberInvitation.create({
          ...query,
          data: {
            id: createId(),
            spaceId: input.spaceId,
            sentUserId: member.userId,
            receivedUserId: targetUser?.id,
            receivedEmail: input.email.toLowerCase(),
            role: input.role,
            state: 'PENDING',
          },
        });
      },
    }),

    updateSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      grantScopes: ['$space:admin'],
      args: { input: t.arg({ type: UpdateSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const meAsMember = await db.spaceMember.existsUnique({
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
            role: 'ADMIN',
          },
        });

        if (!meAsMember) {
          throw new PermissionDeniedError();
        }

        if (input.slug) {
          const isSlugUsed = await db.space.exists({
            where: { slug: input.slug, state: 'ACTIVE', id: { not: input.spaceId } },
          });

          if (isSlugUsed) {
            throw new IntentionalError('이미 사용중인 URL이에요.');
          }
        }

        if (input.externalLinks) {
          await db.spaceExternalLink.deleteMany({
            where: { spaceId: input.spaceId },
          });

          await db.spaceExternalLink.createMany({
            data: input.externalLinks.map((url) => ({
              id: createId(),
              spaceId: input.spaceId,
              url,
            })),
          });
        }

        const space = await db.space.update({
          where: {
            id: input.spaceId,
            state: 'ACTIVE',
          },
          data: {
            name: input.name ?? undefined,
            slug: input.slug ?? undefined,
            iconId: input.iconId ?? undefined,
            description: input.description ?? undefined,
            visibility: match(input.isPublic)
              .with(true, () => 'PUBLIC' as const)
              .with(false, () => 'PRIVATE' as const)
              .otherwise(() => undefined),
          },
        });

        if (input.isPublic === false) {
          const memberUserIds = await db.spaceMember
            .findMany({
              where: {
                spaceId: input.spaceId,
                state: 'ACTIVE',
              },
            })
            .then((members) => members.map((member) => member.userId));

          await db.spaceFollow.deleteMany({
            where: {
              spaceId: input.spaceId,
              userId: { notIn: memberUserIds },
            },
          });
        }

        await indexSpace(space);
        await indexPostByQuery({
          db,
          where: { spaceId: input.spaceId },
        });

        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: space.id },
        });
      },
    }),

    updateSpaceProfile: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMember',
      args: { input: t.arg({ type: UpdateSpaceProfileInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const meAsMember = await db.spaceMember.findUnique({
          include: { user: true },
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
          },
        });

        if (!meAsMember) {
          throw new PermissionDeniedError();
        }

        return db.spaceMember.update({
          ...query,
          where: {
            id: meAsMember.id,
          },
          data: {
            profile:
              meAsMember.profileId === meAsMember.user.profileId
                ? {
                    create: {
                      id: createId(),
                      name: input.profileName,
                      avatarId: input.profileAvatarId,
                    },
                  }
                : {
                    update: {
                      name: input.profileName,
                      avatarId: input.profileAvatarId,
                    },
                  },
          },
        });
      },
    }),

    deleteSpaceProfile: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMember',
      args: { input: t.arg({ type: DeleteSpaceProfileInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const me = await db.user.findUniqueOrThrow({
          where: {
            id: context.session.userId,
          },
        });

        return db.spaceMember.update({
          ...query,
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
          },
          data: {
            profileId: me.profileId,
          },
        });
      },
    }),

    acceptSpaceMemberInvitation: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMemberInvitation',
      grantScopes: ['$space.member.invitation'],
      args: { input: t.arg({ type: AcceptSpaceMemberInvitationInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const invitation = await db.spaceMemberInvitation.findUniqueOrThrow({
          include: { space: true },
          where: {
            id: input.invitationId,
            receivedUserId: context.session.userId,
            state: { not: 'ACCEPTED' },
          },
        });

        const user = await db.user.findUniqueOrThrow({
          include: { profile: true },
          where: { id: context.session.userId },
        });

        let profileId: string;
        if (input.profileName && input.profileAvatarId) {
          const profile = await db.profile.create({
            data: {
              id: createId(),
              name: input.profileName,
              avatarId: input.profileAvatarId,
            },
          });

          profileId = profile.id;
        } else {
          profileId = user.profile.id;
        }

        await db.spaceMember.upsert({
          where: {
            spaceId_userId: {
              spaceId: invitation.spaceId,
              userId: context.session.userId,
            },
          },
          create: {
            id: createId(),
            spaceId: invitation.spaceId,
            userId: context.session.userId,
            profileId,
            role: invitation.role,
            state: 'ACTIVE',
          },
          update: {
            profileId,
            role: invitation.role,
            state: 'ACTIVE',
          },
        });

        await db.spaceFollow.upsert({
          where: {
            userId_spaceId: {
              userId: context.session.userId,
              spaceId: invitation.spaceId,
            },
          },
          create: {
            id: createId(),
            userId: context.session.userId,
            spaceId: invitation.spaceId,
          },
          update: {},
        });

        return await db.spaceMemberInvitation.update({
          ...query,
          where: { id: invitation.id },
          data: {
            state: 'ACCEPTED',
            respondedAt: new Date(),
          },
        });
      },
    }),

    ignoreSpaceMemberInvitation: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMemberInvitation',
      grantScopes: ['$space.member.invitation'],
      args: { input: t.arg({ type: IgnoreSpaceMemberInvitationInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        return await db.spaceMemberInvitation.update({
          ...query,
          where: {
            id: input.invitationId,
            receivedUserId: context.session.userId,
            state: { not: 'ACCEPTED' },
          },
          data: { state: 'IGNORED' },
        });
      },
    }),

    leaveSpace: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMember',
      args: { input: t.arg({ type: LeaveSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const meAsMember = await db.spaceMember.findUniqueOrThrow({
          include: { space: true },
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
          },
        });

        if (meAsMember.role === 'ADMIN') {
          const adminCount = await db.spaceMember.count({
            where: {
              spaceId: input.spaceId,
              role: 'ADMIN',
              state: 'ACTIVE',
            },
          });

          if (adminCount <= 1) {
            throw new IntentionalError('마지막 관리자는 스페이스를 나갈 수 없어요.');
          }
        }

        if (meAsMember.space.visibility === 'PRIVATE') {
          await db.spaceFollow.deleteMany({
            where: {
              userId: context.session.userId,
              spaceId: input.spaceId,
            },
          });
        }

        return await db.spaceMember.update({
          ...query,
          where: {
            id: meAsMember.id,
          },
          data: {
            state: 'INACTIVE',
          },
        });
      },
    }),

    removeSpaceMember: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMember',
      nullable: true,
      args: { input: t.arg({ type: RemoveSpaceMemberInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const kickedMember = await db.spaceMember.findUniqueOrThrow({
          where: {
            id: input.spaceMemberId,
            state: 'ACTIVE',
          },
        });

        const meAsMember = await db.spaceMember.findUniqueOrThrow({
          include: { space: true },
          where: {
            spaceId_userId: {
              spaceId: kickedMember.spaceId,
              userId: context.session.userId,
            },
            role: 'ADMIN',
            state: 'ACTIVE',
          },
        });

        if (meAsMember.id === kickedMember.id) {
          throw new IntentionalError('자기 자신을 추방할 수 없어요.');
        }

        if (meAsMember.space.visibility === 'PRIVATE') {
          await db.spaceFollow.deleteMany({
            where: {
              userId: context.session.userId,
              spaceId: meAsMember.spaceId,
            },
          });
        }

        return await db.spaceMember.update({
          ...query,
          where: {
            id: kickedMember.id,
          },
          data: {
            state: 'INACTIVE',
          },
        });
      },
    }),

    updateSpaceMemberRole: t.withAuth({ user: true }).prismaField({
      type: 'SpaceMember',
      args: { input: t.arg({ type: UpdateSpaceMemberRoleInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const targetMember = await db.spaceMember.findUniqueOrThrow({
          where: {
            id: input.spaceMemberId,
            state: 'ACTIVE',
          },
        });

        const meAsMember = await db.spaceMember.findFirstOrThrow({
          where: {
            spaceId: targetMember.spaceId,
            userId: context.session.userId,
            role: 'ADMIN',
            state: 'ACTIVE',
          },
        });

        if (meAsMember.id === targetMember.id && input.role !== 'ADMIN') {
          const adminCount = await db.spaceMember.count({
            where: {
              spaceId: targetMember.spaceId,
              role: 'ADMIN',
              state: 'ACTIVE',
            },
          });
          if (adminCount <= 1) {
            throw new IntentionalError('마지막 관리자는 권한을 변경할 수 없어요.');
          }
        }

        return await db.spaceMember.update({
          ...query,
          where: {
            id: targetMember.id,
          },
          data: {
            role: input.role,
          },
        });
      },
    }),

    followSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: FollowSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const space = await db.space.findUniqueOrThrow({
          include: {
            members: true,
          },
          where: {
            id: input.spaceId,
            state: 'ACTIVE',
          },
        });

        if (space.visibility === 'PRIVATE') {
          const isMember = await db.spaceMember.existsUnique({
            where: {
              spaceId_userId: {
                userId: context.session.userId,
                spaceId: space.id,
              },
            },
          });
          if (!isMember) {
            throw new PermissionDeniedError();
          }
        }

        await db.spaceFollow.upsert({
          where: {
            userId_spaceId: {
              userId: context.session.userId,
              spaceId: space.id,
            },
          },
          create: {
            id: createId(),
            userId: context.session.userId,
            spaceId: input.spaceId,
          },
          update: {},
        });

        const masquerade = await makeMasquerade({
          db,
          spaceId: space.id,
          userId: context.session.userId,
        });

        await Promise.all(
          space.members.map((member) =>
            createNotification({
              db,
              userId: member.userId,
              category: 'SUBSCRIBE',
              actorId: masquerade.profileId,
              data: { spaceId: space.id },
              origin: context.event.url.origin,
            }),
          ),
        );

        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: space.id },
        });
      },
    }),

    unfollowSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: UnfollowSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const space = await db.space.findUniqueOrThrow({
          include: { members: true },
          where: { id: input.spaceId },
        });

        await db.spaceFollow.deleteMany({
          where: {
            userId: context.session.userId,
            spaceId: space.id,
          },
        });

        const masquerade = await makeMasquerade({
          db,
          spaceId: space.id,
          userId: context.session.userId,
        });

        await db.userNotification.deleteMany({
          where: {
            userId: { in: space.members.map((member) => member.userId) },
            category: 'SUBSCRIBE',
            actorId: masquerade.profileId,
          },
        });

        return db.space.findUniqueOrThrow({
          ...query,
          where: { id: space.id },
        });
      },
    }),

    muteSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: MuteSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        await db.userSpaceMute.upsert({
          where: {
            userId_spaceId: {
              userId: context.session.userId,
              spaceId: input.spaceId,
            },
          },
          create: {
            id: createId(),
            userId: context.session.userId,
            spaceId: input.spaceId,
          },
          update: {},
        });
        return await db.space.findUniqueOrThrow({
          ...query,
          where: { id: input.spaceId },
        });
      },
    }),

    unmuteSpace: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: UnmuteSpaceInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        await db.userSpaceMute.deleteMany({
          where: {
            userId: context.session.userId,
            spaceId: input.spaceId,
          },
        });
        return await db.space.findUniqueOrThrow({
          ...query,
          where: { id: input.spaceId },
        });
      },
    }),

    blockMasquerade: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: BlockMasqueradeInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const meAsMember = await db.spaceMember.findUniqueOrThrow({
          select: { space: query },
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
            role: 'ADMIN',
          },
        });

        await db.spaceMasquerade.update({
          where: {
            id: input.masqueradeId,
            spaceId: input.spaceId,
          },
          data: { blockedAt: new Date() },
        });

        return meAsMember.space;
      },
    }),

    unblockMasquerade: t.withAuth({ user: true }).prismaField({
      type: 'Space',
      args: { input: t.arg({ type: UnblockMasqueradeInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const meAsMember = await db.spaceMember.findUniqueOrThrow({
          select: { space: query },
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
            role: 'ADMIN',
          },
        });

        await db.spaceMasquerade.update({
          where: {
            id: input.masqueradeId,
            spaceId: input.spaceId,
          },
          data: { blockedAt: null },
        });

        return meAsMember.space;
      },
    }),
  }));
});
