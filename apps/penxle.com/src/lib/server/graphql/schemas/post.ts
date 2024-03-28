import { init as cuid } from '@paralleldrive/cuid2';
import { hash, verify } from 'argon2';
import dayjs from 'dayjs';
import * as R from 'radash';
import { match, P } from 'ts-pattern';
import { emojiData } from '$lib/emoji';
import { FormValidationError, IntentionalError, NotFoundError, PermissionDeniedError } from '$lib/errors';
import { redis } from '$lib/server/cache';
import { elasticSearch, indexName } from '$lib/server/search';
import {
  createNotification,
  createRevenue,
  deductUserPoint,
  generatePostShareImage,
  getMutedSpaceIds,
  getMutedTagIds,
  getPostViewCount,
  getUserPoint,
  indexPost,
  indexPostTrendingScore,
  isAdulthood,
  isGte15,
  Loader,
  makeMasquerade,
  makeQueryContainers,
  revisePostContent,
  searchResultToPrismaData,
} from '$lib/server/utils';
import { decorateContent, isEmptyContent, revisionContentToText, sanitizeContent } from '$lib/server/utils/tiptap';
import { base36To10, createId, createTiptapDocument, createTiptapNode, validateTiptapDocument } from '$lib/utils';
import { PublishPostInputSchema, RevisePostInputSchema } from '$lib/validations/post';
import { PrismaEnums } from '$prisma';
import { defineSchema } from '../builder';
import type { JSONContent } from '@tiptap/core';

export const postSchema = defineSchema((builder) => {
  /**
   * * Types
   */

  const CommentOrderByKind = builder.enumType('CommentOrderByKind', {
    values: ['LATEST', 'OLDEST'] as const,
  });

  builder.prismaObject('Post', {
    grantScopes: async (post, { db, ...context }) => {
      // 글 관리 권한이 있는지 체크
      if (context.session?.userId === post.userId) {
        return ['$post:view', '$post:edit'];
      }

      const spaceMemberLoader = Loader.spaceMember({ db, context });
      const member = await spaceMemberLoader.load(post.spaceId);

      if (member?.role === 'ADMIN') {
        return ['$post:view', '$post:edit'];
      }

      // 이 이하부터 글 관리 권한 없음
      // 글을 볼 권한이 없는지 체크

      if (post.state !== 'PUBLISHED' || (post.visibility === 'SPACE' && member?.role !== 'MEMBER')) {
        const purchase = context.session
          ? await db.postPurchase.exists({
              where: {
                postId: post.id,
                userId: context.session.userId,
              },
            })
          : false;

        if (!purchase) {
          return [];
        }
      }

      return ['$post:view'];
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      state: t.expose('state', { type: PrismaEnums.PostState }),

      permalink: t.exposeString('permalink'),
      shortlink: t.field({
        type: 'String',
        resolve: ({ permalink }) => BigInt(permalink).toString(36),
      }),

      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      publishedAt: t.expose('publishedAt', { type: 'DateTime', nullable: true }),

      member: t.relation('member', { nullable: true }),
      space: t.relation('space', { nullable: true }),
      likeCount: t.relationCount('likes'),

      viewCount: t.int({
        resolve: (post, _, { db }) => getPostViewCount({ db, postId: post.id }),
      }),

      viewed: t.boolean({
        select: (_, context, nestedSelection) => {
          return {
            views: context.session
              ? nestedSelection({
                  where: {
                    userId: context.session.userId,
                  },
                })
              : false,
          };
        },
        resolve: async ({ views }) => !!(views && views.length > 0),
      }),

      visibility: t.expose('visibility', { type: PrismaEnums.PostVisibility }),
      ageRating: t.expose('ageRating', { type: PrismaEnums.PostAgeRating }),
      externalSearchable: t.exposeBoolean('externalSearchable'),
      category: t.expose('category', { type: PrismaEnums.PostCategory }),
      pairs: t.expose('pairs', { type: [PrismaEnums.PostPair] }),
      tags: t.relation('tags'),
      discloseStats: t.exposeBoolean('discloseStats'),
      receiveFeedback: t.exposeBoolean('receiveFeedback'),
      receivePatronage: t.exposeBoolean('receivePatronage'),
      receiveTagContribution: t.exposeBoolean('receiveTagContribution'),
      protectContent: t.exposeBoolean('protectContent'),
      commentQualification: t.expose('commentQualification', { type: PrismaEnums.PostCommentQualification }),

      thumbnail: t.relation('thumbnail', {
        authScopes: { $granted: '$post:view' },
        nullable: true,
        unauthorizedResolver: () => null,
      }),

      hasPassword: t.boolean({
        resolve: (post) => !!post.password,
      }),

      unlocked: t.boolean({
        resolve: async (post, _, context) => {
          if (!post.password) {
            return true;
          }

          const unlock = await redis.hget(`Post:${post.id}:passwordUnlock`, context.deviceId);
          return !!unlock && dayjs(unlock).isAfter(dayjs());
        },
      }),

      blurred: t.boolean({
        select: {
          tags: { where: { kind: 'TRIGGER' } },
          ageRating: true,
        },
        resolve: async (post, _, { db, ...context }) => {
          if (post.ageRating === 'ALL') return post.tags.length > 0;
          if (!context.session) return true;

          const contentFilter = await db.userContentFilterPreference.findUnique({
            where: {
              userId_category: {
                userId: context.session.userId,
                category: 'ADULT',
              },
            },
          });

          return contentFilter?.action !== 'EXPOSE';
        },
      }),

      publishedRevision: t.relation('publishedRevision', {
        authScopes: { $granted: '$post:view' },
        nullable: true,
        unauthorizedResolver: () => null,
      }),

      revisions: t.relation('revisions', {
        authScopes: { $granted: '$post:edit' },
        grantScopes: ['$postRevision:edit'],
        query: {
          orderBy: { createdAt: 'desc' },
        },
      }),

      draftRevision: t.prismaField({
        type: 'PostRevision',
        authScopes: { $granted: '$post:edit' },
        grantScopes: ['$postRevision:edit'],
        args: { revisionId: t.arg.id({ required: false }) },
        select: ({ revisionId }, __, nestedSelection) => ({
          revisions: nestedSelection({
            where: { id: revisionId },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }),
        }),
        resolve: (_, { revisions }) => revisions[0],
      }),

      liked: t.boolean({
        resolve: async (post, _, { db, ...context }) => {
          if (!context.session) {
            return false;
          }

          return await db.postLike.existsUnique({
            where: {
              postId_userId: {
                postId: post.id,
                userId: context.session.userId,
              },
            },
          });
        },
      }),

      reactions: t.prismaField({
        type: ['PostReaction'],
        resolve: async (query, post, _, { db, ...context }) => {
          if (!post.receiveFeedback) {
            return [];
          }

          if (!context.session) {
            return db.postReaction.findMany({
              ...query,
              where: { postId: post.id },
            });
          }

          return [
            ...(await db.postReaction.findMany({
              ...query,
              where: {
                postId: post.id,
                userId: context.session.userId,
              },
              orderBy: { createdAt: 'desc' },
            })),
            ...(await db.postReaction.findMany({
              ...query,
              where: {
                postId: post.id,
                userId: { not: context.session.userId },
              },
              orderBy: { createdAt: 'desc' },
            })),
          ];
        },
      }),

      reactionCount: t.relationCount('reactions'),

      bookmarkGroups: t.prismaField({
        type: ['BookmarkGroup'],
        select: (_, context, nestedSelection) => {
          if (!context.session) {
            return {};
          }
          return {
            bookmarks: {
              select: { bookmarkGroup: nestedSelection() },
              where: {
                bookmarkGroup: {
                  userId: context.session?.userId,
                },
              },
            },
          };
        },
        resolve: (_, post, __, context) => {
          if (!context.session) {
            return [];
          }

          // @ts-expect-error session이 있으면 bookmarkGroup도 존재함 (이거 타입가드를 깔끔하게 할 수 있는 방법이 없을까요...)
          return R.sift(post.bookmarks.map((bookmark) => bookmark.bookmarkGroup ?? null));
        },

        unauthorizedResolver: () => [],
      }),

      collection: t.prismaField({
        type: 'SpaceCollection',
        nullable: true,
        select: (_, __, nestedSelection) => ({
          collectionPost: {
            where: { collection: { state: 'ACTIVE' } },
            select: { collection: nestedSelection() },
          },
        }),

        resolve: (_, { collectionPost }) => {
          return collectionPost ? collectionPost.collection : null;
        },
      }),

      purchasedAt: t.field({
        type: 'DateTime',
        nullable: true,
        select: (_, context) => ({
          purchases: context.session
            ? {
                where: {
                  userId: context.session?.userId,
                },
                take: 1,
              }
            : undefined,
        }),

        resolve: ({ purchases }, _, context) => {
          if (!context.session) {
            return null;
          }

          return purchases[0]?.createdAt ?? null;
        },
      }),

      previousPost: t.prismaField({
        type: 'Post',
        nullable: true,
        resolve: async (query, post, _, { db, ...context }) => {
          if (!post.publishedAt) {
            return null;
          }

          const spaceMemberLoader = Loader.spaceMember({ db, context });
          const meAsMember = await spaceMemberLoader.load(post.spaceId);

          return db.post.findFirst({
            ...query,
            where: {
              spaceId: post.spaceId,
              state: 'PUBLISHED',
              publishedAt: { lt: post.publishedAt },
              visibility: meAsMember ? undefined : 'PUBLIC',
            },
            orderBy: { publishedAt: 'desc' },
          });
        },
      }),

      nextPost: t.prismaField({
        type: 'Post',
        nullable: true,
        resolve: async (query, post, _, { db, ...context }) => {
          if (!post.publishedAt) {
            return null;
          }

          const spaceMemberLoader = Loader.spaceMember({ db, context });
          const meAsMember = await spaceMemberLoader.load(post.spaceId);

          return await db.post.findFirst({
            ...query,
            where: {
              spaceId: post.spaceId,
              state: 'PUBLISHED',
              publishedAt: { gt: post.publishedAt },
              visibility: meAsMember ? undefined : 'PUBLIC',
            },
            orderBy: { publishedAt: 'asc' },
          });
        },
      }),

      recommendedPosts: t.prismaField({
        type: ['Post'],
        select: { publishedRevision: true },
        resolve: async (query, post, _, { db, ...context }) => {
          if (!post.publishedRevision) {
            return [];
          }

          const [postTagIds, mutedTagIds, mutedSpaceIds, recentlyViewedPostIds] = await Promise.all([
            db.postTag
              .findMany({
                where: { postId: post.id },
              })
              .then((tags) => tags.map(({ tagId }) => tagId)),
            getMutedTagIds({ db, userId: context.session?.userId }),
            getMutedSpaceIds({ db, userId: context.session?.userId }),
            context.session
              ? db.postView
                  .findMany({
                    where: { userId: context.session?.userId },
                    orderBy: { viewedAt: 'desc' },
                    take: 100,
                  })
                  .then((views) => [...views.map(({ postId }) => postId), post.id])
              : [post.id],
          ]);

          const searchResult = await elasticSearch.search({
            index: indexName('posts'),
            query: {
              function_score: {
                query: {
                  bool: {
                    should: [
                      { terms: { 'tags.id': postTagIds } },
                      { term: { ['spaceId']: post.spaceId } },
                      { rank_feature: { field: 'trendingScore' } },
                    ],
                    must_not: makeQueryContainers([
                      {
                        query: {
                          terms: { ['tags.id']: mutedTagIds },
                        },
                        condition: mutedTagIds.length > 0,
                      },
                      {
                        query: {
                          terms: { spaceId: mutedSpaceIds },
                        },
                        condition: mutedSpaceIds.length > 0,
                      },
                      {
                        query: {
                          ids: { values: recentlyViewedPostIds },
                        },
                      },
                    ]),
                  },
                },
                functions: [
                  {
                    random_score: { seed: Math.floor(Math.random() * 1000), field: '_seq_no' },
                  },
                ],
              },
            },

            size: 3,
          });

          return searchResultToPrismaData({
            searchResult,
            db,
            tableName: 'post',
            queryArgs: {
              ...query,
              where: {
                state: 'PUBLISHED',
                space: {
                  state: 'ACTIVE',
                  visibility: 'PUBLIC',
                },
              },
            },
          });
        },
      }),

      commentCount: t.relationCount('comments', {
        args: { pagination: t.arg.boolean({ defaultValue: false }) },
        where: ({ pagination }) => {
          if (!pagination) {
            return { state: 'ACTIVE' as const };
          }
          return {
            OR: [
              { state: 'ACTIVE' as const },
              {
                childComments: {
                  some: { state: 'ACTIVE' as const },
                },
              },
            ],
            parentId: null,
          };
        },
      }),

      comments: t.prismaField({
        type: ['PostComment'],
        args: {
          orderBy: t.arg({ type: CommentOrderByKind, defaultValue: 'OLDEST' }),
          page: t.arg.int({ defaultValue: 1 }),
          take: t.arg.int({ defaultValue: 5 }),
        },
        resolve: async (query, post, { orderBy, page, take }, { db }) => {
          if (post.commentQualification === 'NONE') return [];

          const orderQuery = match(orderBy)
            .with('OLDEST', () => ({ createdAt: 'asc' as const }))
            .with('LATEST', () => ({ createdAt: 'desc' as const }))
            .exhaustive();

          const pinnedComments = await db.postComment.findMany({
            ...query,
            where: {
              postId: post.id,
              state: 'ACTIVE',
              pinned: true,
              profile: {
                OR: [
                  {
                    spaceMasquerade: {
                      NOT: {
                        blockedAt: { not: null },
                      },
                    },
                  },
                  {
                    spaceMasquerade: null,
                  },
                ],
              },
            },
            orderBy: orderQuery,
            take,
            skip: (page - 1) * take,
          });

          if (pinnedComments.length >= take) {
            return pinnedComments;
          }

          const pinnedCommentsCount = await db.postComment.count({
            where: {
              postId: post.id,
              state: 'ACTIVE',
              pinned: true,
              profile: {
                OR: [
                  {
                    spaceMasquerade: {
                      NOT: {
                        blockedAt: { not: null },
                      },
                    },
                  },
                  {
                    spaceMasquerade: null,
                  },
                ],
              },
            },
          });

          const comments = await db.postComment.findMany({
            ...query,
            where: {
              postId: post.id,
              pinned: false,
              parentId: null,
              profile: {
                OR: [
                  {
                    spaceMasquerade: {
                      NOT: {
                        blockedAt: { not: null },
                      },
                    },
                  },
                  {
                    spaceMasquerade: null,
                  },
                ],
              },
              OR: [
                { state: 'ACTIVE' },
                {
                  childComments: {
                    some: { state: 'ACTIVE' },
                  },
                },
              ],
            },
            orderBy: orderQuery,
            take: take - pinnedComments.length,
            skip: Math.max(0, (page - 1) * take - pinnedCommentsCount),
          });

          return [...pinnedComments, ...comments];
        },
      }),

      //// deprecated

      purchasedRevision: t.withAuth({ user: true }).prismaField({
        type: 'PostRevision',
        deprecationReason: 'Use PostPurchase.revision instead',
        nullable: true,
        select: (_, context, nestedSelection) => ({
          revisions: nestedSelection({
            where: {
              purchases: {
                some: { userId: context.session.userId },
              },
            },
            take: 1,
          }),
        }),

        resolve: (_, { revisions }) => revisions[0],
      }),
    }),
  });

  builder.prismaObject('PostRevision', {
    grantScopes: async (revision, { db, ...context }) => {
      const postLoader = Loader.post({ db, context });
      const post = await postLoader.load(revision.postId);

      if (!post) {
        return [];
      }

      if (post.ageRating !== 'ALL') {
        if (!context.session) {
          return [];
        }

        const identity = await db.userPersonalIdentity.findUnique({
          where: { userId: context.session.userId },
        });

        if (
          !identity ||
          (post.ageRating === 'R19' && !isAdulthood(identity.birthday)) ||
          (post.ageRating === 'R15' && !isGte15(identity.birthday))
        ) {
          return [];
        }
      }

      if (post.password && post.userId !== context.session?.userId) {
        const unlock = await redis.hget(`Post:${post.id}:passwordUnlock`, context.deviceId);
        if (!unlock || dayjs().isAfter(dayjs(unlock))) {
          return [];
        }
      }

      if (post.spaceId) {
        const spaceMasqueradeLoader = Loader.spaceMasquerade({ db, context });
        const masquerade = await spaceMasqueradeLoader.load(post.spaceId);
        if (masquerade?.blockedAt) {
          return [];
        }
      }

      return ['$postRevision:view'];
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      kind: t.expose('kind', { type: PrismaEnums.PostRevisionKind }),
      title: t.exposeString('title', { nullable: true }),
      subtitle: t.exposeString('subtitle', { nullable: true }),
      price: t.exposeInt('price', { nullable: true }),
      paragraphIndent: t.exposeInt('paragraphIndent'),
      paragraphSpacing: t.exposeInt('paragraphSpacing'),

      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      updatedAt: t.expose('updatedAt', { type: 'DateTime' }),

      editableContent: t.field({
        type: 'JSON',
        authScopes: { $granted: '$postRevision:edit' },
        select: { price: true, freeContent: true, paidContent: true },
        resolve: async (revision, _, { db }) => {
          const freeContent = revision.freeContent
            ? await decorateContent(db, revision.freeContent.data as JSONContent[])
            : [{ type: 'paragraph' }];
          const paidContent = revision.paidContent
            ? await decorateContent(db, revision.paidContent.data as JSONContent[])
            : null;

          return createTiptapDocument([
            ...freeContent,
            createTiptapNode({ type: 'access_barrier', attrs: { price: revision.price } }),
            ...(paidContent ?? []),
          ]);
        },
      }),

      content: t.field({
        type: 'JSON',
        authScopes: { $granted: '$postRevision:view' },
        select: { post: true, freeContent: true, paidContent: true },
        resolve: async (revision, _, { db, ...context }) => {
          const freeContent = revision.freeContent
            ? await decorateContent(db, revision.freeContent.data as JSONContent[])
            : [{ type: 'paragraph' }];
          const paidContent = revision.paidContent
            ? await decorateContent(db, revision.paidContent.data as JSONContent[])
            : null;

          if (!paidContent || paidContent.length === 0) {
            return createTiptapDocument(freeContent);
          }

          // 유료분이 있음 - 유료분을 볼 수 있는 경우는?

          if (context.session) {
            if (context.session.userId === revision.post.userId) {
              // 1. 글 작성자 자신
              return createTiptapDocument([
                ...freeContent,
                createTiptapNode({
                  type: 'access_barrier',
                  attrs: {
                    price: revision.price,
                    __data: { purchasable: false },
                  },
                }),
                ...paidContent,
              ]);
            }

            if (revision.post.spaceId) {
              const purchase = await db.postPurchase.findUnique({
                where: {
                  postId_userId: {
                    postId: revision.post.id,
                    userId: context.session.userId,
                  },
                },
              });

              if (purchase) {
                // 2. 구매한 경우
                return createTiptapDocument([
                  ...freeContent,
                  createTiptapNode({
                    type: 'access_barrier',
                    attrs: {
                      price: revision.price,
                      __data: {
                        purchasable: false,
                        purchasedAt: dayjs(purchase.createdAt).toISOString(),
                      },
                    },
                  }),
                  ...paidContent,
                ]);
              }

              const isMember = await db.spaceMember.existsUnique({
                where: {
                  spaceId_userId: {
                    spaceId: revision.post.spaceId,
                    userId: context.session.userId,
                  },
                },
              });

              if (isMember) {
                // 3. 해당 스페이스의 멤버인 경우
                return createTiptapDocument([
                  ...freeContent,
                  createTiptapNode({
                    type: 'access_barrier',
                    attrs: {
                      price: revision.price,
                      __data: { purchasable: false },
                    },
                  }),
                  ...paidContent,
                ]);
              }
            }
          }

          const paidContentText = revision.paidContent ? await revisionContentToText(revision.paidContent) : '';

          let paidContentImageCount = 0,
            paidContentFileCount = 0;
          for (const node of paidContent) {
            // eslint-disable-next-line unicorn/prefer-switch
            if (node.type === 'image') {
              paidContentImageCount++;
            } else if (node.type === 'gallery') {
              paidContentImageCount += node.attrs?.ids?.length ?? 0;
            } else if (node.type === 'file') {
              paidContentFileCount++;
            }
          }

          return createTiptapDocument([
            ...freeContent,
            createTiptapNode({
              type: 'access_barrier',
              attrs: {
                price: revision.price,
                __data: {
                  purchasable: true,

                  point: context.session ? await getUserPoint({ db, userId: context.session.userId }) : null,

                  postId: revision.post.id,
                  revisionId: revision.id,

                  counts: {
                    characters: paidContentText.length,
                    images: paidContentImageCount,
                    files: paidContentFileCount,
                  },
                },
              },
            }),
          ]);
        },

        unauthorizedResolver: () => createTiptapDocument([]),
      }),

      characterCount: t.field({
        type: 'Int',
        authScopes: { $granted: '$postRevision:view' },
        select: { freeContent: true, paidContent: true },
        resolve: async (revision) => {
          const contentText = revision.freeContent ? await revisionContentToText(revision.freeContent) : '';
          const paidContentText = revision.paidContent ? await revisionContentToText(revision.paidContent) : '';
          return contentText.length + paidContentText.length;
        },

        unauthorizedResolver: () => 0,
      }),

      previewText: t.field({
        type: 'String',
        authScopes: { $granted: '$postRevision:view' },
        select: { freeContent: true },
        resolve: async (revision) => {
          const contentText = revision.freeContent ? await revisionContentToText(revision.freeContent) : '';
          return contentText.slice(0, 200).replaceAll(/\s+/g, ' ');
        },

        unauthorizedResolver: () => '',
      }),
    }),
  });

  builder.prismaObject('PostReaction', {
    fields: (t) => ({
      id: t.exposeID('id'),
      emoji: t.exposeString('emoji'),

      mine: t.boolean({
        resolve: async (reaction, _, { ...context }) => {
          if (!context.session) {
            return false;
          }

          return reaction.userId === context.session.userId;
        },
      }),
    }),
  });

  /**
   * * Inputs
   */

  const TagInput = builder.inputType('TagInput', {
    fields: (t) => ({
      name: t.string(),
      kind: t.field({ type: PrismaEnums.PostTagKind }),
    }),
  });

  const CreatePostInput = builder.inputType('CreatePostInput', {
    fields: (t) => ({
      spaceId: t.id({ required: false }),
    }),
  });

  const RevisePostInput = builder.inputType('RevisePostInput', {
    fields: (t) => ({
      revisionKind: t.field({ type: PrismaEnums.PostRevisionKind }),

      postId: t.id(),

      title: t.string({ required: false }),
      subtitle: t.string({ required: false }),
      content: t.field({ type: 'JSON' }),

      paragraphIndent: t.int(),
      paragraphSpacing: t.int(),
    }),
    validate: { schema: RevisePostInputSchema },
  });

  const PublishPostInput = builder.inputType('PublishPostInput', {
    fields: (t) => ({
      revisionId: t.id(),
      spaceId: t.id(),
      collectionId: t.id({ required: false }),
      thumbnailId: t.id({ required: false }),
      visibility: t.field({ type: PrismaEnums.PostVisibility }),
      password: t.string({ required: false }),
      ageRating: t.field({ type: PrismaEnums.PostAgeRating }),
      externalSearchable: t.boolean(),
      discloseStats: t.boolean(),
      receiveFeedback: t.boolean(),
      receivePatronage: t.boolean(),
      receiveTagContribution: t.boolean(),
      protectContent: t.boolean(),
      commentQualification: t.field({
        type: PrismaEnums.PostCommentQualification,
        required: false,
        defaultValue: 'ANY',
      }),
      category: t.field({ type: PrismaEnums.PostCategory }),
      pairs: t.field({ type: [PrismaEnums.PostPair], defaultValue: [] }),
      tags: t.field({ type: [TagInput], defaultValue: [] }),
    }),
    validate: { schema: PublishPostInputSchema },
  });

  const UpdatePostOptionsInput = builder.inputType('UpdatePostOptionsInput', {
    fields: (t) => ({
      postId: t.id(),
      visibility: t.field({ type: PrismaEnums.PostVisibility, required: false }),
      discloseStats: t.boolean({ required: false }),
      receiveFeedback: t.boolean({ required: false }),
      receivePatronage: t.boolean({ required: false }),
      receiveTagContribution: t.boolean({ required: false }),
    }),
  });

  const UpdatePostTagsInput = builder.inputType('UpdatePostTagsInput', {
    fields: (t) => ({
      postId: t.id(),
      category: t.field({ type: PrismaEnums.PostCategory }),
      pairs: t.field({ type: [PrismaEnums.PostPair] }),
      tags: t.field({ type: [TagInput] }),
    }),
  });

  const DeletePostInput = builder.inputType('DeletePostInput', {
    fields: (t) => ({
      postId: t.id(),
    }),
  });

  const LikePostInput = builder.inputType('LikePostInput', {
    fields: (t) => ({
      postId: t.id(),
    }),
  });

  const UnlikePostInput = builder.inputType('UnlikePostInput', {
    fields: (t) => ({
      postId: t.id(),
    }),
  });

  const PurchasePostInput = builder.inputType('PurchasePostInput', {
    fields: (t) => ({
      postId: t.id(),
      revisionId: t.id(),
    }),
  });

  const UpdatePostViewInput = builder.inputType('UpdatePostViewInput', {
    fields: (t) => ({
      postId: t.id(),
    }),
  });

  const CreatePostReactionInput = builder.inputType('CreatePostReactionInput', {
    fields: (t) => ({
      postId: t.id(),
      emoji: t.string(),
    }),
  });

  const DeletePostReactionInput = builder.inputType('DeletePostReactionInput', {
    fields: (t) => ({
      postId: t.id(),
      emoji: t.string(),
    }),
  });

  const UnlockPasswordedPostInput = builder.inputType('UnlockPasswordedPostInput', {
    fields: (t) => ({
      postId: t.id(),
      password: t.string(),
    }),
  });

  const GeneratePostShareImageInput = builder.inputType('GeneratePostShareImageInput', {
    fields: (t) => ({
      title: t.string(),
      space: t.string(),
      body: t.string(),
      font: t.string(), // Pretendard, RIDIBatang
      size: t.string(), // small, medium, large
      color: t.string(), // hex code
      background: t.string(), // hex code
    }),
  });

  /**
   * * Queries
   */

  builder.queryFields((t) => ({
    post: t.prismaField({
      type: 'Post',
      args: { permalink: t.arg.string() },
      resolve: async (query, _, args, { db, ...context }) => {
        const post = await db.post.findUnique({
          include: { space: true },
          where: { permalink: args.permalink },
        });

        if (!post) {
          throw new NotFoundError();
        }

        if (post.userId !== context.session?.userId || post.state === 'DELETED') {
          if (!post.space) {
            throw new NotFoundError();
          }
          if (
            post.space.state === 'INACTIVE' ||
            post.space.visibility === 'PRIVATE' ||
            post.state === 'DRAFT' ||
            post.visibility === 'SPACE' ||
            post.state === 'DELETED'
          ) {
            if (!context.session) {
              throw new PermissionDeniedError();
            }

            const member =
              post.state === 'DELETED'
                ? null
                : await db.spaceMember.findUnique({
                    where: {
                      spaceId_userId: {
                        spaceId: post.space.id,
                        userId: context.session.userId,
                      },
                      state: 'ACTIVE',
                    },
                  });

            if (!member || (post.state === 'DRAFT' && member.role !== 'ADMIN')) {
              const purchase = await db.postPurchase.exists({
                where: {
                  postId: post.id,
                  userId: context.session.userId,
                },
              });

              if (!purchase) {
                throw new PermissionDeniedError();
              }
            }
          }
        }

        return await db.post.findUniqueOrThrow({
          ...query,
          where: { id: post.id },
        });
      },
    }),

    // draftRevision: t.withAuth({ user: true }).prismaField({
    //   type: 'PostRevision',
    //   args: { revisionId: t.arg.id() },
    //   resolve: async (query, _, args, { db, ...context }) =>
    //     // TODO: 어드민도 접근할 수 있게 권한 체크 추가
    //     db.postRevision.findUniqueOrThrow({
    //       ...query,
    //       where: {
    //         id: args.revisionId,
    //         userId: context.session.userId,
    //       },
    //     }),
    // }),
  }));

  /**
   * * Mutations
   */

  builder.mutationFields((t) => ({
    createPost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: CreatePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        let permalink: string;

        for (;;) {
          permalink = base36To10(cuid({ length: 6 })());
          const exists = await db.post.exists({ where: { permalink } });
          if (!exists) {
            break;
          }
        }

        return await db.post.create({
          ...query,
          data: {
            id: createId(),
            permalink,
            userId: context.session.userId,
            spaceId: input.spaceId,
            state: 'EPHEMERAL',
            visibility: 'PUBLIC',
            discloseStats: true,
            receiveFeedback: true,
            receivePatronage: true,
            receiveTagContribution: true,
            protectContent: true,
            revisions: {
              create: {
                id: createId(),
                userId: context.session.userId,
                kind: 'AUTO_SAVE',
              },
            },
          },
        });
      },
    }),

    revisePost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: RevisePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.findUniqueOrThrow({
          where: {
            id: input.postId,
            state: { not: 'DELETED' },
          },
        });

        if (post.userId !== context.session.userId) {
          if (!post.spaceId) {
            throw new NotFoundError();
          }

          const meAsMember = await db.spaceMember.findUniqueOrThrow({
            where: {
              spaceId_userId: {
                spaceId: post.spaceId,
                userId: context.session.userId,
              },
            },
          });

          if (meAsMember.role !== 'ADMIN') {
            throw new NotFoundError();
          }
        }

        let document = (input.content as JSONContent).content;

        if (!document || !validateTiptapDocument(input.content)) {
          throw new FormValidationError('content', '잘못된 내용이에요');
        }

        const lastRevision = input.postId
          ? await db.postRevision.findFirst({
              include: { freeContent: true, paidContent: true },
              where: { postId: input.postId },
              orderBy: { createdAt: 'desc' },
            })
          : undefined;

        document = await sanitizeContent(document);

        const accessBarrierPosition = document.findIndex((node) => node.type === 'access_barrier');
        const accessBarrier = accessBarrierPosition === -1 ? null : document[accessBarrierPosition];
        const freeContentData = accessBarrierPosition === -1 ? document : document.slice(0, accessBarrierPosition);
        const paidContentData = accessBarrierPosition === -1 ? [] : document.slice(accessBarrierPosition + 1);

        const freeContent = isEmptyContent(freeContentData)
          ? null
          : await revisePostContent({ db, contentData: freeContentData });
        const paidContent = isEmptyContent(paidContentData)
          ? null
          : await revisePostContent({ db, contentData: paidContentData });
        const price: number | null = paidContent ? accessBarrier?.attrs?.price ?? null : null;

        const revisionData = {
          userId: context.session.userId,
          kind: input.revisionKind,
          title: input.title?.length ? input.title : null,
          subtitle: input.subtitle?.length ? input.subtitle : null,
          freeContentId: freeContent?.id ?? null,
          paidContentId: paidContent?.id ?? null,
          price,
          paragraphIndent: input.paragraphIndent,
          paragraphSpacing: input.paragraphSpacing,
        } as const;

        /// 여기까지 데이터 가공 단계
        /// 여기부터 포스트 수정 단계

        // 2. 리비전 생성/재사용

        let revisionId = createId();

        const checkContentLengthDiff = async () => {
          if (!lastRevision) return 0;
          const lastRevisionContentLength =
            (lastRevision.freeContent ? await revisionContentToText(lastRevision.freeContent) : '').length +
            (lastRevision.paidContent ? await revisionContentToText(lastRevision.paidContent) : '').length;
          const currentContentLength =
            (freeContent ? await revisionContentToText(freeContent) : '').length +
            (paidContent ? await revisionContentToText(paidContent) : '').length;

          return Math.abs(lastRevisionContentLength - currentContentLength);
        };

        if (
          lastRevision &&
          lastRevision.kind === 'AUTO_SAVE' &&
          dayjs(lastRevision.createdAt).add(1, 'minutes').isAfter(dayjs()) &&
          (await checkContentLengthDiff()) < 100
        ) {
          await db.postRevision.update({
            where: { id: lastRevision.id },
            data: {
              ...revisionData,
              updatedAt: new Date(),
            },
          });
          revisionId = lastRevision.id;

          // dangling PostContent 삭제
          if (lastRevision.freeContentId) {
            const freeContentReference = await db.postRevision.exists({
              where: {
                OR: [{ freeContentId: lastRevision.freeContentId }, { paidContentId: lastRevision.freeContentId }],
              },
            });

            if (!freeContentReference) {
              try {
                await db.postRevisionContent.delete({
                  where: { id: lastRevision.freeContentId },
                });
              } catch {
                // pass
              }
            }
          }

          if (lastRevision.paidContentId) {
            const paidContentReference = await db.postRevision.exists({
              where: {
                OR: [{ freeContentId: lastRevision.paidContentId }, { paidContentId: lastRevision.paidContentId }],
              },
            });

            if (!paidContentReference) {
              try {
                await db.postRevisionContent.delete({
                  where: { id: lastRevision.paidContentId },
                });
              } catch {
                // pass
              }
            }
          }
        } else {
          await db.postRevision.create({
            data: {
              id: revisionId,
              postId: input.postId,
              ...revisionData,
            },
          });
        }

        /// 게시글에 수정된 부분이 있을 경우 포스트 상태를 DRAFT로 변경
        if (
          post.state === 'EPHEMERAL' &&
          (input.title?.length || input.subtitle?.length || freeContent || paidContent)
        ) {
          await db.post.update({
            where: { id: input.postId },
            data: { state: 'DRAFT' },
          });
        }

        /// 여기까지 포스트 생성/수정 단계

        return await db.post.findUniqueOrThrow({
          ...query,
          where: { id: input.postId },
        });
      },
    }),

    publishPost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: PublishPostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const revision = await db.postRevision.update({
          include: { post: true, freeContent: true, paidContent: true },
          where: {
            id: input.revisionId,
            post: {
              state: { not: 'DELETED' },
            },
          },
          data: { kind: 'PUBLISHED' },
        });

        if (revision.post.state === 'PUBLISHED' && revision.post.spaceId && revision.post.spaceId !== input.spaceId) {
          throw new IntentionalError('발행된 포스트의 스페이스를 변경할 수 없어요');
        }

        const meAsMember = await db.spaceMember.findUnique({
          where: {
            spaceId_userId: {
              spaceId: input.spaceId,
              userId: context.session.userId,
            },
            state: 'ACTIVE',
          },
        });

        if (!meAsMember || (revision.userId !== context.session.userId && meAsMember.role !== 'ADMIN')) {
          throw new PermissionDeniedError();
        }

        if (input.ageRating !== 'ALL') {
          const identity = await db.userPersonalIdentity.findUnique({
            where: { userId: context.session.userId },
          });

          if (
            !identity ||
            (input.ageRating === 'R19' && !isAdulthood(identity.birthday)) ||
            (input.ageRating === 'R15' && !isGte15(identity.birthday))
          ) {
            throw new IntentionalError('본인인증을 하지 않으면 연령 제한 컨텐츠를 게시할 수 없어요');
          }
        }

        if (revision.paidContent) {
          if (revision.price === null) {
            if ((revision.paidContent.data as JSONContent[] | undefined)?.length === 0) {
              await db.postRevision.update({
                where: { id: input.revisionId },
                data: { paidContentId: null },
              });
            } else {
              throw new IntentionalError('가격을 설정해주세요');
            }
          } else {
            if (revision.price <= 0 || revision.price > 1_000_000 || revision.price % 100 !== 0) {
              throw new IntentionalError('잘못된 가격이에요');
            }
          }
        }

        const password = await match(input.password)
          .with('', () => revision.post.password)
          .with(P.string, (password) => hash(password))
          .with(P.nullish, () => null)
          .exhaustive();

        if (input.password) {
          await redis.del(`Post:${revision.post.id}:passwordUnlock`);
        }

        const postTags = await Promise.all(
          (input.tags ?? []).map((tag) =>
            db.tag.upsert({
              where: { name: tag.name },
              create: {
                id: createId(),
                name: tag.name,
              },
              update: {},
            }),
          ),
        );

        await db.postRevision.updateMany({
          where: {
            postId: revision.post.id,
            kind: 'PUBLISHED',
            id: { not: revision.id },
          },
          data: { kind: 'ARCHIVED' },
        });

        const post = await db.post.update({
          include: {
            tags: { include: { tag: true } },
            publishedRevision: true,
            space: true,
            collectionPost: true,
          },
          where: { id: revision.post.id },
          data: {
            spaceId: input.spaceId,
            memberId: meAsMember.id,
            state: 'PUBLISHED',
            publishedAt: revision.post.publishedAt ?? new Date(),
            publishedRevisionId: revision.id,
            visibility: input.visibility,
            ageRating: input.ageRating,
            thumbnailId: input.thumbnailId ?? null,
            externalSearchable: input.externalSearchable,
            discloseStats: input.discloseStats,
            receiveFeedback: input.receiveFeedback,
            receivePatronage: input.receivePatronage,
            receiveTagContribution: input.receiveTagContribution,
            protectContent: input.protectContent,
            commentQualification: input.commentQualification ?? 'ANY',
            password,
            category: input.category,
            pairs: input.pairs,
            tags: {
              deleteMany: {},
              createMany: {
                data: input.tags.map(({ name, kind }) => ({
                  id: createId(),
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  tagId: postTags.find((tag) => tag.name === name)!.id,
                  kind,
                })),
              },
            },
          },
        });

        if (input.collectionId) {
          if (post.collectionPost?.collectionId !== input.collectionId) {
            if (post.collectionPost) {
              await db.spaceCollectionPost.delete({
                where: {
                  postId: post.id,
                },
              });
            }

            const targetCollectionAggregation = await db.spaceCollectionPost.aggregate({
              where: {
                collectionId: input.collectionId,
              },
              _max: {
                order: true,
              },
            });

            const order = targetCollectionAggregation._max.order ?? -1;

            await db.spaceCollectionPost.create({
              data: {
                id: createId(),
                postId: post.id,
                collectionId: input.collectionId,
                order: order + 1,
              },
            });
          }
        } else {
          await db.spaceCollectionPost.deleteMany({
            where: {
              postId: post.id,
            },
          });
        }

        await indexPost(post);
        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: post.id },
        });
      },
    }),

    updatePostOptions: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: UpdatePostOptionsInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.update({
          include: {
            tags: { include: { tag: true } },
            publishedRevision: true,
            space: true,
          },
          where: {
            id: input.postId,
            OR: [
              { userId: context.session.userId },
              { space: { members: { some: { userId: context.session.userId, role: 'ADMIN', state: 'ACTIVE' } } } },
            ],
          },

          data: {
            visibility: input.visibility ?? undefined,
            discloseStats: input.discloseStats ?? undefined,
            receiveFeedback: input.receiveFeedback ?? undefined,
            receivePatronage: input.receivePatronage ?? undefined,
            receiveTagContribution: input.receiveTagContribution ?? undefined,
          },
        });

        await indexPost(post);

        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: post.id },
        });
      },
    }),

    updatePostTags: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: UpdatePostTagsInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.findUniqueOrThrow({
          where: { id: input.postId },
        });

        if (post.userId !== context.session.userId) {
          const meAsMember = post.spaceId
            ? await db.spaceMember.findUnique({
                where: {
                  spaceId_userId: {
                    spaceId: post.spaceId,
                    userId: context.session.userId,
                  },

                  state: 'ACTIVE',
                },
              })
            : null;

          if (meAsMember?.role !== 'ADMIN') {
            throw new PermissionDeniedError();
          }
        }

        const postTags = await Promise.all(
          (input.tags ?? []).map((tag) =>
            db.tag.upsert({
              where: { name: tag.name },
              create: {
                id: createId(),
                name: tag.name,
              },
              update: {},
            }),
          ),
        );

        return db.post.update({
          ...query,
          where: { id: post.id },
          data: {
            category: input.category,
            pairs: input.pairs,
            tags: {
              deleteMany: {},
              createMany: {
                data: input.tags.map(({ name, kind }) => ({
                  id: createId(),
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  tagId: postTags.find((tag) => tag.name === name)!.id,
                  kind,
                })),
              },
            },
          },
        });
      },
    }),

    deletePost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: DeletePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.findUniqueOrThrow({
          where: { id: input.postId },
        });

        if (post.userId !== context.session.userId) {
          const meAsMember = post.spaceId
            ? await db.spaceMember.findUnique({
                where: {
                  spaceId_userId: {
                    spaceId: post.spaceId,
                    userId: context.session.userId,
                  },
                },
              })
            : null;

          if (meAsMember?.role !== 'ADMIN') {
            throw new PermissionDeniedError();
          }
        }

        await db.spaceCollectionPost.deleteMany({
          where: { postId: post.id },
        });

        return await db.post.update({
          ...query,
          where: { id: post.id },
          data: {
            state: 'DELETED',
            publishedRevision: post.publishedRevisionId ? { update: { kind: 'ARCHIVED' } } : undefined,
          },
        });
      },
    }),

    likePost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: LikePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        return db.post.update({
          ...query,
          where: { id: input.postId },
          data: {
            likes: {
              upsert: {
                where: {
                  postId_userId: {
                    postId: input.postId,
                    userId: context.session.userId,
                  },
                },
                create: {
                  id: createId(),
                  userId: context.session.userId,
                },
                update: {},
              },
            },
          },
        });
      },
    }),

    unlikePost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: UnlikePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        return db.post.update({
          ...query,
          where: { id: input.postId },
          data: {
            likes: {
              deleteMany: {
                userId: context.session.userId,
              },
            },
          },
        });
      },
    }),

    purchasePost: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: PurchasePostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.findUniqueOrThrow({
          include: { space: true, publishedRevision: true },
          where: { id: input.postId },
        });

        if (!post.space || !post.publishedRevision?.price) {
          throw new IntentionalError('구매할 수 없는 포스트예요');
        }

        const isMember = await db.spaceMember.existsUnique({
          where: {
            spaceId_userId: {
              spaceId: post.space.id,
              userId: context.session.userId,
            },
          },
        });

        if (isMember) {
          throw new IntentionalError('자신이 속한 스페이스의 포스트는 구매할 수 없어요');
        }

        const purchased = await db.postPurchase.existsUnique({
          where: {
            postId_userId: {
              postId: input.postId,
              userId: context.session.userId,
            },
          },
        });

        if (purchased) {
          throw new IntentionalError('이미 구매한 포스트예요');
        }

        if (post.publishedRevision.id !== input.revisionId) {
          throw new IntentionalError('포스트 내용이 변경되었어요. 다시 시도해 주세요');
        }

        const purchase = await db.postPurchase.create({
          data: {
            id: createId(),
            userId: context.session.userId,
            postId: input.postId,
            revisionId: post.publishedRevision.id,
            pointAmount: post.publishedRevision.price,
          },
        });

        await deductUserPoint({
          db,
          userId: context.session.userId,
          amount: post.publishedRevision.price,
          targetId: purchase.id,
          cause: 'UNLOCK_CONTENT',
        });

        await createRevenue({
          db,
          userId: post.userId,
          amount: post.publishedRevision.price,
          targetId: purchase.id,
          kind: 'POST_PURCHASE',
        });

        const masquerade = await makeMasquerade({
          db,
          userId: context.session.userId,
          spaceId: post.space.id,
        });

        await createNotification({
          db,
          userId: post.userId,
          category: 'PURCHASE',
          actorId: masquerade.profileId,
          data: { postId: post.id },
          origin: context.event.url.origin,
        });

        return await db.post.findUniqueOrThrow({
          ...query,
          where: { id: input.postId },
        });
      },
    }),

    updatePostView: t.prismaField({
      type: 'Post',
      args: { input: t.arg({ type: UpdatePostViewInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const view = await db.postView.findFirst({
          where: {
            postId: input.postId,
            userId: context.session ? context.session.userId : undefined,
            deviceId: context.session ? undefined : context.deviceId,
          },
        });

        if (view) {
          await db.postView.update({
            where: { id: view.id },
            data: {
              deviceId: context.deviceId,
              viewedAt: new Date(),
            },
          });
        } else {
          await db.postView.create({
            data: {
              id: createId(),
              postId: input.postId,
              userId: context.session?.userId,
              deviceId: context.deviceId,
            },
          });

          const viewCount = await redis.get(`Post:${input.postId}:viewCount`);
          if (viewCount) {
            await redis.incr(`Post:${input.postId}:viewCount`);
          }

          indexPostTrendingScore({ db, postId: input.postId }).then();
        }

        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: input.postId },
        });
      },
    }),

    createPostReaction: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: CreatePostReactionInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        if (!emojiData.emojis[input.emoji]) {
          throw new IntentionalError('잘못된 이모지예요');
        }

        const post = await db.post.findUniqueOrThrow({
          where: { id: input.postId },
        });

        if (!post.receiveFeedback) {
          throw new IntentionalError('피드백을 받지 않는 포스트예요');
        }

        await db.postReaction.create({
          data: {
            id: createId(),
            userId: context.session.userId,
            postId: input.postId,
            emoji: input.emoji,
          },
        });

        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: input.postId },
        });
      },
    }),

    deletePostReaction: t.withAuth({ user: true }).prismaField({
      type: 'Post',
      args: { input: t.arg({ type: DeletePostReactionInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        await db.postReaction.deleteMany({
          where: {
            postId: input.postId,
            userId: context.session.userId,
            emoji: input.emoji,
          },
        });
        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: input.postId },
        });
      },
    }),

    unlockPasswordedPost: t.prismaField({
      type: 'Post',
      args: { input: t.arg({ type: UnlockPasswordedPostInput }) },
      resolve: async (query, _, { input }, { db, ...context }) => {
        const post = await db.post.findUniqueOrThrow({
          where: { id: input.postId },
        });

        if (post.password) {
          if (!(await verify(post.password, input.password))) {
            throw new FormValidationError('password', '잘못된 비밀번호예요');
          }

          await redis.hset(`Post:${post.id}:passwordUnlock`, context.deviceId, dayjs().add(1, 'hour').toISOString());
          await redis.expire(`Post:${post.id}:passwordUnlock`, 60 * 60);
        }

        return db.post.findUniqueOrThrow({
          ...query,
          where: { id: post.id },
        });
      },
    }),

    generatePostShareImage: t.string({
      args: { input: t.arg({ type: GeneratePostShareImageInput }) },
      resolve: async (_, { input }) => {
        const png = await generatePostShareImage(input);
        return `data:image/png;base64,${png.toString('base64')}`;
      },
    }),
  }));
});
