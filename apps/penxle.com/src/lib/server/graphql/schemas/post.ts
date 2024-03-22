import { init as cuid } from '@paralleldrive/cuid2';
import { hash, verify } from 'argon2';
import dayjs from 'dayjs';
import { and, asc, count, desc, eq, exists, gt, inArray, isNotNull, isNull, lt, ne, notExists, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { match, P } from 'ts-pattern';
import { emojiData } from '$lib/emoji';
import {
  PostAgeRating,
  PostCategory,
  PostCommentQualification,
  PostPair,
  PostRevisionKind,
  PostState,
  PostTagKind,
  PostVisibility,
} from '$lib/enums';
import { FormValidationError, IntentionalError, NotFoundError, PermissionDeniedError } from '$lib/errors';
import { redis } from '$lib/server/cache';
import {
  BookmarkGroupPosts,
  BookmarkGroups,
  database,
  PostComments,
  PostLikes,
  PostPurchases,
  PostReactions,
  PostRevisionContents,
  PostRevisions,
  Posts,
  PostTags,
  PostViews,
  Revenues,
  SpaceCollectionPosts,
  SpaceCollections,
  SpaceMasquerades,
  SpaceMembers,
  Spaces,
  Tags,
  UserContentFilterPreferences,
  UserPersonalIdentities,
} from '$lib/server/database';
import { elasticSearch, indexName } from '$lib/server/search';
import {
  createNotification,
  deductUserPoint,
  defragmentSpaceCollectionPosts,
  generatePostShareImage,
  getMutedSpaceIds,
  getMutedTagIds,
  getPostViewCount,
  getSpaceMember,
  getUserPoint,
  isAdulthood,
  isGte15,
  makeMasquerade,
  makePostContentId,
  makeQueryContainers,
  searchResultToIds,
} from '$lib/server/utils';
import { decorateContent, revisionContentToText, sanitizeContent } from '$lib/server/utils/tiptap';
import {
  base36To10,
  createTiptapDocument,
  createTiptapNode,
  makeNullableArrayElement,
  validateTiptapDocument,
} from '$lib/utils';
import { PublishPostInputSchema, RevisePostInputSchema } from '$lib/validations/post';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { BookmarkGroup } from './bookmark';
import { SpaceCollection } from './collection';
import { PostComment } from './comment';
import { Image } from './image';
import { Space, SpaceMember } from './space';
import { PostTag } from './tag';
import type { JSONContent } from '@tiptap/core';

/**
 * * Types
 */

const CommentOrderByKind = builder.enumType('CommentOrderByKind', {
  values: ['LATEST', 'OLDEST'] as const,
});

export const Post = createObjectRef('Post', Posts);
Post.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    state: t.expose('state', { type: PostState }),

    permalink: t.exposeString('permalink'),
    shortlink: t.string({
      resolve: ({ permalink }) => BigInt(permalink).toString(36),
    }),

    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    publishedAt: t.expose('publishedAt', { type: 'DateTime', nullable: true }),

    member: t.field({
      type: SpaceMember,
      nullable: true,
      resolve: (post) => post.memberId,
    }),

    space: t.field({
      type: Space,
      nullable: true,
      resolve: (post) => post.spaceId,
    }),

    tags: t.field({
      type: [PostTag],
      resolve: async (post, _, context) => {
        const loader = context.loader({
          name: 'Post.tags',
          many: true,
          load: async (ids: string[]) => {
            return await database.select().from(PostTags).where(inArray(PostTags.postId, ids));
          },
          key: (row) => row.postId,
        });

        return loader.load(post.id);
      },
    }),

    visibility: t.expose('visibility', { type: PostVisibility }),
    ageRating: t.expose('ageRating', { type: PostAgeRating }),
    externalSearchable: t.exposeBoolean('externalSearchable'),
    category: t.expose('category', { type: PostCategory }),
    pairs: t.expose('pairs', { type: [PostPair] }),

    discloseStats: t.exposeBoolean('discloseStats'),
    receiveFeedback: t.exposeBoolean('receiveFeedback'),
    receivePatronage: t.exposeBoolean('receivePatronage'),
    receiveTagContribution: t.exposeBoolean('receiveTagContribution'),
    protectContent: t.exposeBoolean('protectContent'),
    commentQualification: t.expose('commentQualification', { type: PostCommentQualification }),

    thumbnail: t.field({
      type: Image,
      nullable: true,
      resolve: (post) => post.thumbnailId,
    }),

    likeCount: t.int({
      resolve: async (post) => {
        const [{ value }] = await database
          .select({ value: count() })
          .from(PostLikes)
          .where(eq(PostLikes.postId, post.id));
        return value;
      },
    }),

    viewCount: t.int({
      resolve: (post) => getPostViewCount(post.id),
    }),

    viewed: t.boolean({
      resolve: async (post, _, context) => {
        if (!context.session) {
          return false;
        }

        const views = await database
          .select({ id: PostViews.id })
          .from(PostViews)
          .where(and(eq(PostViews.postId, post.id), eq(PostViews.userId, context.session.userId)));

        return views.length > 0;
      },
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
      resolve: async (post, _, context) => {
        if (post.ageRating !== 'ALL' && !context.session) {
          return true;
        }

        const triggerTagsLoader = context.loader({
          name: 'Post.blurred > triggerTags',
          many: true,
          load: async (ids: string[]) => {
            return await database
              .select({ postId: PostTags.postId })
              .from(PostTags)
              .where(and(inArray(PostTags.postId, ids), eq(PostTags.kind, 'TRIGGER')));
          },
          key: (row) => row?.postId,
        });

        const triggerTags = await triggerTagsLoader.load(post.id);

        if (triggerTags.length > 0) {
          return true;
        }

        if (post.ageRating === 'ALL') {
          return false;
        }

        const adultFiltersLoader = context.loader({
          name: 'Post.blurred > adultFilters',
          nullable: true,
          load: async (ids: string[]) => {
            return await database
              .select({ userId: UserContentFilterPreferences.userId, action: UserContentFilterPreferences.action })
              .from(UserContentFilterPreferences)
              .where(
                and(
                  inArray(UserContentFilterPreferences.userId, ids),
                  eq(UserContentFilterPreferences.category, 'ADULT'),
                ),
              );
          },
          key: (row) => row?.userId,
        });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const adultFilters = await adultFiltersLoader.load(context.session!.userId);

        return adultFilters?.action !== 'EXPOSE';
      },
    }),

    publishedRevision: t.field({
      type: PostRevision,
      nullable: true,
      resolve: (post) => post.publishedRevisionId,
    }),

    revisions: t.field({
      type: [PostRevision],
      resolve: async (post) =>
        await database
          .select({ id: PostRevisions.id })
          .from(PostRevisions)
          .where(eq(PostRevisions.postId, post.id))
          .then((revisions) => revisions.map((revision) => revision.id)),
    }),

    draftRevision: t.field({
      type: PostRevision,
      args: { revisionId: t.arg.id({ required: false }) },
      resolve: async (post, { revisionId }, context) => {
        if (revisionId) {
          return revisionId;
        }

        const loader = context.loader({
          name: 'PostRevision.draftRevision',
          load: async (ids: string[]) => {
            return await database
              .selectDistinctOn([PostRevisions.postId])
              .from(PostRevisions)
              .where(inArray(PostRevisions.postId, ids))
              .orderBy(asc(PostRevisions.postId), desc(PostRevisions.createdAt), asc(PostRevisions.id));
          },
          key: (revision) => revision.postId,
        });

        return await loader.load(post.id);
      },
    }),

    liked: t.boolean({
      resolve: async (post, _, context) => {
        if (!context.session) {
          return false;
        }

        const likes = await database
          .select({ id: PostLikes.id })
          .from(PostLikes)
          .where(and(eq(PostLikes.postId, post.id), eq(PostLikes.userId, context.session.userId)));

        return likes.length > 0;
      },
    }),

    reactions: t.field({
      type: [PostReaction],
      resolve: async (post, _, context) => {
        if (!post.receiveFeedback) {
          return [];
        }

        if (!context.session) {
          return await database
            .select()
            .from(PostReactions)
            .where(eq(PostReactions.postId, post.id))
            .orderBy(desc(PostReactions.createdAt));
        }

        return [
          ...(await database
            .select()
            .from(PostReactions)
            .where(and(eq(PostReactions.postId, post.id), eq(PostReactions.userId, context.session.userId)))
            .orderBy(desc(PostReactions.createdAt))),
          ...(await database
            .select()
            .from(PostReactions)
            .where(and(eq(PostReactions.postId, post.id), ne(PostReactions.userId, context.session.userId)))
            .orderBy(desc(PostReactions.createdAt))),
        ];
      },
    }),

    reactionCount: t.int({
      resolve: async (post) =>
        await database
          .select({ count: count() })
          .from(PostReactions)
          .where(eq(PostReactions.postId, post.id))
          .then(([{ count }]) => count),
    }),

    bookmarkGroups: t.field({
      type: [BookmarkGroup],
      resolve: async (post, _, context) => {
        if (!context.session) {
          return [];
        }

        return await database
          .select({ id: BookmarkGroups.id })
          .from(BookmarkGroups)
          .innerJoin(BookmarkGroupPosts, eq(BookmarkGroups.id, BookmarkGroupPosts.bookmarkGroupId))
          .where(and(eq(BookmarkGroups.userId, context.session.userId), eq(BookmarkGroupPosts.postId, post.id)))
          .then((groups) => groups.map((group) => group.id));
      },
    }),

    collection: t.field({
      type: SpaceCollection,
      nullable: true,
      resolve: async (post) =>
        database
          .select({ id: SpaceCollections.id })
          .from(SpaceCollections)
          .innerJoin(SpaceCollectionPosts, eq(SpaceCollections.id, SpaceCollectionPosts.collectionId))
          .where(and(eq(SpaceCollectionPosts.postId, post.id), eq(SpaceCollections.state, 'ACTIVE')))
          .then((collections) => collections[0]?.id),
    }),

    purchasedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: async (post, _, context) => {
        if (!context.session) {
          return null;
        }

        return await database
          .select({ createdAt: PostPurchases.createdAt })
          .from(PostPurchases)
          .where(and(eq(PostPurchases.postId, post.id), eq(PostPurchases.userId, context.session.userId)))
          .then((purchases) => purchases[0]?.createdAt);
      },
    }),

    previousPost: t.field({
      type: Post,
      nullable: true,
      resolve: async (post) => {
        if (!post.publishedAt || !post.spaceId) {
          return null;
        }

        const posts = await database
          .select()
          .from(Posts)
          .where(
            and(
              eq(Posts.spaceId, post.spaceId),
              eq(Posts.state, 'PUBLISHED'),
              eq(Posts.visibility, 'PUBLIC'),
              lt(Posts.publishedAt, post.publishedAt),
            ),
          )
          .orderBy(desc(Posts.publishedAt))
          .limit(1);

        if (posts.length === 0) {
          return null;
        }

        return posts[0];
      },
    }),

    nextPost: t.field({
      type: Post,
      nullable: true,
      resolve: async (post) => {
        if (!post.publishedAt || !post.spaceId) {
          return null;
        }

        const posts = await database
          .select()
          .from(Posts)
          .where(
            and(
              eq(Posts.spaceId, post.spaceId),
              eq(Posts.state, 'PUBLISHED'),
              eq(Posts.visibility, 'PUBLIC'),
              gt(Posts.publishedAt, post.publishedAt),
            ),
          )
          .orderBy(asc(Posts.publishedAt))
          .limit(1);

        if (posts.length === 0) {
          return null;
        }

        return posts[0];
      },
    }),

    recommendedPosts: t.field({
      type: [Post],
      resolve: async (post, _, context) => {
        if (!post.publishedRevisionId) {
          return [];
        }

        const [postTagIds, mutedTagIds, mutedSpaceIds, recentlyViewedPostIds] = await Promise.all([
          database
            .select({ tagId: PostTags.tagId })
            .from(PostTags)
            .where(eq(PostTags.postId, post.id))
            .then((rows) => rows.map((row) => row.tagId)),
          getMutedTagIds({ userId: context.session?.userId }),
          getMutedSpaceIds({ userId: context.session?.userId }),
          context.session
            ? database
                .select({ postId: PostViews.postId })
                .from(PostViews)
                .where(eq(PostViews.userId, context.session.userId))
                .orderBy(desc(PostViews.viewedAt))
                .limit(50)
                .then((views) => views.map((view) => view.postId))
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

        const posts = await database
          .select({ id: Posts.id })
          .from(Posts)
          .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
          .where(
            and(
              inArray(Posts.id, searchResultToIds(searchResult)),
              eq(Posts.state, 'PUBLISHED'),
              eq(Posts.visibility, 'PUBLIC'),
              eq(Spaces.state, 'ACTIVE'),
              eq(Spaces.visibility, 'PUBLIC'),
            ),
          );

        return posts.map((post) => post.id);
      },
    }),

    commentCount: t.int({
      args: { pagination: t.arg.boolean({ defaultValue: false }) },
      resolve: async (post, { pagination }) => {
        if (pagination) {
          const ChildComments = alias(PostComments, 'child');

          return await database
            .select({ count: count() })
            .from(PostComments)
            .where(
              and(
                eq(PostComments.postId, post.id),
                isNull(PostComments.parentId),
                or(
                  eq(PostComments.state, 'ACTIVE'),
                  exists(
                    database
                      .select({ id: ChildComments.id })
                      .from(ChildComments)
                      .where(and(eq(ChildComments.parentId, PostComments.id), eq(ChildComments.state, 'ACTIVE'))),
                  ),
                ),
              ),
            )
            .then(([result]) => result.count);
        } else {
          return await database
            .select({ count: count() })
            .from(PostComments)
            .where(and(eq(PostComments.postId, post.id), eq(PostComments.state, 'ACTIVE')))
            .then(([result]) => result.count);
        }
      },
    }),

    comments: t.field({
      type: [PostComment],
      args: {
        orderBy: t.arg({ type: CommentOrderByKind, defaultValue: 'OLDEST' }),
        page: t.arg.int({ defaultValue: 1 }),
        take: t.arg.int({ defaultValue: 5 }),
      },
      resolve: async (post, { orderBy, page, take }) => {
        if (post.commentQualification === 'NONE') {
          return [];
        }

        const pinnedCommentIds = await database
          .select({ id: PostComments.id })
          .from(PostComments)
          .where(
            and(
              eq(PostComments.postId, post.id),
              eq(PostComments.state, 'ACTIVE'),
              eq(PostComments.pinned, true),
              notExists(
                database
                  .select({ id: SpaceMasquerades.id })
                  .from(SpaceMasquerades)
                  .where(
                    and(eq(SpaceMasquerades.profileId, PostComments.profileId), isNotNull(SpaceMasquerades.blockedAt)),
                  ),
              ),
            ),
          )
          .orderBy(orderBy === 'OLDEST' ? asc(PostComments.createdAt) : desc(PostComments.createdAt))
          .then((comments) => comments.map((comment) => comment.id));

        const pagedPinnedCommentIds = pinnedCommentIds.slice((page - 1) * take, page * take);
        if (pagedPinnedCommentIds.length === take) {
          return pagedPinnedCommentIds;
        }

        const ChildComments = alias(PostComments, 'child');

        const comments = await database
          .select()
          .from(PostComments)
          .where(
            and(
              eq(PostComments.postId, post.id),
              isNull(PostComments.parentId),
              eq(PostComments.pinned, false),
              or(
                eq(PostComments.state, 'ACTIVE'),
                exists(
                  database
                    .select({ id: ChildComments.id })
                    .from(ChildComments)
                    .where(and(eq(ChildComments.parentId, PostComments.id), eq(ChildComments.state, 'ACTIVE'))),
                ),
              ),
              notExists(
                database
                  .select({ id: SpaceMasquerades.id })
                  .from(SpaceMasquerades)
                  .where(
                    and(eq(SpaceMasquerades.profileId, PostComments.profileId), isNotNull(SpaceMasquerades.blockedAt)),
                  ),
              ),
            ),
          )
          .orderBy(orderBy === 'OLDEST' ? asc(PostComments.createdAt) : desc(PostComments.createdAt))
          .limit(take - pagedPinnedCommentIds.length)
          .offset(Math.max(0, (page - 1) * take - pinnedCommentIds.length));

        return [...pagedPinnedCommentIds, ...comments];
      },
    }),

    purchasedRevision: t.withAuth({ user: true }).field({
      type: PostRevision,
      nullable: true,
      resolve: async (post, _, context) => {
        return await database
          .select({ revisionId: PostPurchases.revisionId })
          .from(PostPurchases)
          .where(and(eq(PostPurchases.postId, post.id), eq(PostPurchases.userId, context.session.userId)))
          .then(([purchase]) => purchase?.revisionId);
      },
    }),
  }),
});

export const PostRevision = createObjectRef('PostRevision', PostRevisions);
PostRevision.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.expose('kind', { type: PostRevisionKind }),
    title: t.exposeString('title', { nullable: true }),
    subtitle: t.exposeString('subtitle', { nullable: true }),
    price: t.exposeInt('price', { nullable: true }),
    paragraphIndent: t.exposeInt('paragraphIndent'),
    paragraphSpacing: t.exposeInt('paragraphSpacing'),

    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),

    editableContent: t.field({
      type: 'JSON',
      resolve: async (revision, _, context) => {
        const loader = context.loader({
          name: 'PostRevision.editableContent',
          load: async (ids: string[]) => {
            return await database
              .select({ id: PostRevisionContents.id, data: PostRevisionContents.data })
              .from(PostRevisionContents)
              .where(inArray(PostRevisionContents.id, ids));
          },
          key: (content) => content.id,
        });

        const [freeContentRaw, paidContentRaw] = await Promise.all([
          revision.freeContentId ? loader.load(revision.freeContentId) : undefined,
          revision.paidContentId ? loader.load(revision.paidContentId) : undefined,
        ]);

        const [freeContent, paidContent] = await Promise.all([
          freeContentRaw ? decorateContent(freeContentRaw.data as JSONContent[]) : [{ type: 'paragraph' }],
          paidContentRaw ? decorateContent(paidContentRaw.data as JSONContent[]) : [],
        ]);

        return createTiptapDocument([
          ...freeContent,
          createTiptapNode({ type: 'access_barrier', attrs: { price: revision.price } }),
          ...(paidContent ?? []),
        ]);
      },
    }),

    content: t.field({
      type: 'JSON',
      resolve: async (revision, _, context) => {
        const [freeContentRaw, paidContentRaw] = await Promise.all([
          revision.freeContentId
            ? database
                .select({ data: PostRevisionContents.data })
                .from(PostRevisionContents)
                .where(eq(PostRevisionContents.id, revision.freeContentId))
                .then((contents) => contents[0]?.data as JSONContent[])
            : undefined,
          revision.paidContentId
            ? database
                .select({ data: PostRevisionContents.data })
                .from(PostRevisionContents)
                .where(eq(PostRevisionContents.id, revision.paidContentId))
                .then((contents) => contents[0]?.data as JSONContent[])
            : undefined,
        ]);

        const [freeContent, paidContent] = await Promise.all([
          freeContentRaw ? decorateContent(freeContentRaw) : [{ type: 'paragraph' }],
          paidContentRaw ? decorateContent(paidContentRaw) : null,
        ]);

        if (!paidContent || paidContent.length === 0) {
          return createTiptapDocument(freeContent);
        }

        // 유료분이 있음 - 유료분을 볼 수 있는 경우는?

        if (context.session) {
          const post = await database
            .select()
            .from(Posts)
            .where(eq(Posts.id, revision.postId))
            .then((posts) => posts[0]);

          if (context.session.userId === post.userId) {
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

          if (post.spaceId) {
            const purchase = await database
              .select({ createdAt: PostPurchases.createdAt })
              .from(PostPurchases)
              .where(and(eq(PostPurchases.postId, post.id), eq(PostPurchases.userId, context.session.userId)))
              .then(makeNullableArrayElement)
              .then((purchases) => purchases[0]);

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

            const meAsMember = await database
              .select({ id: SpaceMembers.id })
              .from(SpaceMembers)
              .where(and(eq(SpaceMembers.spaceId, post.spaceId), eq(SpaceMembers.userId, context.session.userId)))
              .then(makeNullableArrayElement)
              .then((members) => members[0]);

            if (meAsMember) {
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

        const paidContentText = revision.paidContentId
          ? await revisionContentToText({ id: revision.paidContentId, data: paidContent })
          : '';

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

                point: context.session ? await getUserPoint({ userId: context.session.userId }) : null,

                postId: revision.postId,
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
    }),

    characterCount: t.int({
      resolve: async (revision, _, context) => {
        const loader = context.loader({
          name: 'PostRevision.characterCount',
          load: async (ids: string[]) => {
            return await database
              .select({ id: PostRevisionContents.id, data: PostRevisionContents.data })
              .from(PostRevisionContents)
              .where(inArray(PostRevisionContents.id, ids));
          },
          key: (content) => content.id,
        });

        const [freeContentLength, paidContentLength] = await Promise.all([
          revision.freeContentId
            ? loader
                .load(revision.freeContentId)
                .then((content) => revisionContentToText(content))
                .then((contentText) => contentText.length)
            : 0,
          revision.paidContentId
            ? loader
                .load(revision.paidContentId)
                .then((content) => revisionContentToText(content))
                .then((contentText) => contentText.length)
            : 0,
        ]);

        return freeContentLength + paidContentLength;
      },
    }),

    previewText: t.string({
      resolve: async (revision, _, context) => {
        const loader = context.loader({
          name: 'PostRevision.previewText',
          load: async (ids: string[]) => {
            return await database
              .select({ id: PostRevisionContents.id, data: PostRevisionContents.data })
              .from(PostRevisionContents)
              .where(inArray(PostRevisionContents.id, ids));
          },
          key: (content) => content.id,
        });

        const contentText = revision.freeContentId
          ? await loader.load(revision.freeContentId).then((content) => revisionContentToText(content))
          : '';

        return contentText.slice(0, 200).replaceAll(/\s+/g, ' ');
      },
    }),
  }),
});

export const PostReaction = createObjectRef('PostReaction', PostReactions);
PostReaction.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    emoji: t.exposeString('emoji'),

    mine: t.boolean({
      resolve: (reaction, _, { ...context }) => {
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
    kind: t.field({ type: PostTagKind }),
  }),
});

const CreatePostInput = builder.inputType('CreatePostInput', {
  fields: (t) => ({
    spaceId: t.id({ required: false }),
  }),
});

const RevisePostInput = builder.inputType('RevisePostInput', {
  fields: (t) => ({
    revisionKind: t.field({ type: PostRevisionKind }),

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
    visibility: t.field({ type: PostVisibility }),
    password: t.string({ required: false }),
    ageRating: t.field({ type: PostAgeRating }),
    externalSearchable: t.boolean(),
    discloseStats: t.boolean(),
    receiveFeedback: t.boolean(),
    receivePatronage: t.boolean(),
    receiveTagContribution: t.boolean(),
    protectContent: t.boolean(),
    commentQualification: t.field({
      type: PostCommentQualification,
      required: false,
      defaultValue: 'ANY',
    }),
    category: t.field({ type: PostCategory }),
    pairs: t.field({ type: [PostPair], defaultValue: [] }),
    tags: t.field({ type: [TagInput], defaultValue: [] }),
  }),
  validate: { schema: PublishPostInputSchema },
});

const UpdatePostOptionsInput = builder.inputType('UpdatePostOptionsInput', {
  fields: (t) => ({
    postId: t.id(),
    visibility: t.field({ type: PostVisibility, required: false }),
    discloseStats: t.boolean({ required: false }),
    receiveFeedback: t.boolean({ required: false }),
    receivePatronage: t.boolean({ required: false }),
    receiveTagContribution: t.boolean({ required: false }),
  }),
});

const UpdatePostTagsInput = builder.inputType('UpdatePostTagsInput', {
  fields: (t) => ({
    postId: t.id(),
    category: t.field({ type: PostCategory }),
    pairs: t.field({ type: [PostPair] }),
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
  post: t.field({
    type: Post,
    args: { permalink: t.arg.string() },
    resolve: async (_, args, context) => {
      const posts = await database
        .select({
          id: Posts.id,
          userId: Posts.userId,
          visibility: Posts.visibility,
          state: Posts.state,
          space: { id: Spaces.id, visibility: Spaces.visibility, state: Spaces.state },
        })
        .from(Posts)
        .innerJoin(Spaces, eq(Posts.spaceId, Spaces.id))
        .where(and(eq(Posts.permalink, args.permalink), ne(Posts.state, 'DELETED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.space.visibility === 'PRIVATE' || post.visibility === 'SPACE') {
        const meAsMember = await getSpaceMember(context, post.space.id);
        if (!meAsMember) {
          throw new PermissionDeniedError();
        }
      }

      return post.id;
    },
  }),

  draftPost: t.withAuth({ user: true }).field({
    type: Post,
    args: { permalink: t.arg.string() },
    resolve: async (_, args, context) => {
      const posts = await database
        .select({
          id: Posts.id,
          userId: Posts.userId,
          visibility: Posts.visibility,
          state: Posts.state,
          space: { id: Spaces.id, visibility: Spaces.visibility, state: Spaces.state },
        })
        .from(Posts)
        .leftJoin(Spaces, eq(Posts.spaceId, Spaces.id))
        .where(
          and(
            eq(Posts.permalink, args.permalink),
            ne(Posts.state, 'DELETED'),
            or(eq(Spaces.state, 'ACTIVE'), isNull(Spaces.id)),
          ),
        );

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.space && post.userId !== context.session.userId) {
        const meAsMember = await getSpaceMember(context, post.space.id);
        if (meAsMember?.role !== 'ADMIN') {
          throw new PermissionDeniedError();
        }
      }

      return post.id;
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  createPost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: CreatePostInput }) },
    resolve: async (_, { input }, context) => {
      let permalink;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        permalink = base36To10(cuid({ length: 6 })());

        const posts = await database.select({ id: Posts.id }).from(Posts).where(eq(Posts.permalink, permalink));
        if (posts.length === 0) {
          break;
        }
      }

      return await database.transaction(async (tx) => {
        const [post] = await tx
          .insert(Posts)
          .values({
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
          })
          .returning({ id: Posts.id });

        await tx.insert(PostRevisions).values({
          postId: post.id,
          userId: context.session.userId,
          kind: 'AUTO_SAVE',
        });

        return post.id;
      });
    },
  }),

  revisePost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: RevisePostInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ userId: Posts.userId, spaceId: Posts.spaceId, state: Posts.state })
        .from(Posts)
        .leftJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .where(
          and(
            eq(Posts.id, input.postId),
            ne(Posts.state, 'DELETED'),
            or(eq(Spaces.state, 'ACTIVE'), isNull(Spaces.id)),
          ),
        );

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.userId !== context.session.userId) {
        if (!post.spaceId) {
          throw new PermissionDeniedError();
        }

        const meAsMember = await getSpaceMember(context, post.spaceId);
        if (meAsMember?.role !== 'ADMIN') {
          throw new PermissionDeniedError();
        }
      }

      let document = (input.content as JSONContent).content;

      if (!document || !validateTiptapDocument(input.content)) {
        throw new FormValidationError('content', '잘못된 내용이에요');
      }

      const FreeContents = alias(PostRevisionContents, 'a1');
      const PaidContents = alias(PostRevisionContents, 'a2');

      const revisions = await database
        .select({ id: PostRevisions.id, kind: PostRevisions.kind, createdAt: PostRevisions.createdAt })
        .from(PostRevisions)
        .leftJoin(FreeContents, eq(FreeContents.id, PostRevisions.freeContentId))
        .leftJoin(PaidContents, eq(PaidContents.id, PostRevisions.paidContentId))
        .where(eq(PostRevisions.postId, input.postId))
        .orderBy(desc(PostRevisions.createdAt))
        .limit(1);

      if (revisions.length === 0) {
        throw new NotFoundError();
      }

      const [revision] = revisions;

      document = await sanitizeContent(document);

      const accessBarrierPosition = document.findIndex((node) => node.type === 'access_barrier');
      const accessBarrier = document[accessBarrierPosition];
      const freeContentData = document.slice(0, accessBarrierPosition);
      const paidContentData = document.slice(accessBarrierPosition + 1);

      const freeContentId = await makePostContentId(freeContentData);
      const paidContentId = await makePostContentId(paidContentData);
      const price: number | null = paidContentId ? accessBarrier.attrs?.price ?? null : null;

      const revisionData: typeof PostRevisions.$inferInsert = {
        postId: input.postId,
        userId: context.session.userId,
        kind: input.revisionKind,
        title: input.title?.length ? input.title : null,
        subtitle: input.subtitle?.length ? input.subtitle : null,
        freeContentId,
        paidContentId,
        price,
        paragraphIndent: input.paragraphIndent,
        paragraphSpacing: input.paragraphSpacing,
        updatedAt: dayjs(),
      };

      await (revision.kind === 'AUTO_SAVE' && revision.createdAt.isAfter(dayjs().subtract(1, 'minute'))
        ? database.update(PostRevisions).set(revisionData).where(eq(PostRevisions.id, revision.id))
        : database.insert(PostRevisions).values(revisionData));

      /// 게시글에 수정된 부분이 있을 경우 포스트 상태를 DRAFT로 변경
      if (
        post.state === 'EPHEMERAL' &&
        (input.title?.length || input.subtitle?.length || freeContentId || paidContentId)
      ) {
        await database.update(Posts).set({ state: 'DRAFT' }).where(eq(Posts.id, input.postId));
      }

      return input.postId;
    },
  }),

  publishPost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: PublishPostInput }) },
    resolve: async (_, { input }, context) => {
      const revisions = await database
        .select({
          userId: PostRevisions.userId,
          paidContentId: PostRevisions.paidContentId,
          price: PostRevisions.price,
          post: { id: Posts.id, state: Posts.state },
          space: { id: Spaces.id },
          collectionPost: { id: SpaceCollectionPosts.id, collectionId: SpaceCollectionPosts.collectionId },
        })
        .from(PostRevisions)
        .innerJoin(Posts, eq(Posts.id, PostRevisions.postId))
        .leftJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .leftJoin(SpaceCollectionPosts, eq(SpaceCollectionPosts.postId, Posts.id))
        .where(
          and(
            eq(PostRevisions.id, input.revisionId),
            ne(Posts.state, 'DELETED'),
            or(eq(Spaces.state, 'ACTIVE'), isNull(Spaces.id)),
          ),
        );

      if (revisions.length === 0) {
        throw new NotFoundError();
      }

      const [revision] = revisions;

      if (revision.post.state === 'PUBLISHED' && revision.space?.id !== input.spaceId) {
        throw new IntentionalError('발행된 포스트의 스페이스를 변경할 수 없어요');
      }

      const meAsMember = await getSpaceMember(context, input.spaceId);
      if (!meAsMember) {
        throw new PermissionDeniedError();
      }

      if (revision.userId !== context.session.userId && meAsMember.role !== 'ADMIN') {
        throw new PermissionDeniedError();
      }

      if (input.ageRating !== 'ALL') {
        const identities = await database
          .select({ birthday: UserPersonalIdentities.birthday })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, context.session.userId));

        if (
          identities.length === 0 ||
          (input.ageRating === 'R19' && !isAdulthood(identities[0].birthday)) ||
          (input.ageRating === 'R15' && !isGte15(identities[0].birthday))
        ) {
          throw new IntentionalError('본인인증을 하지 않으면 연령 제한 컨텐츠를 게시할 수 없어요');
        }
      }

      if (revision.paidContentId) {
        if (revision.price === null) {
          throw new IntentionalError('가격을 설정해주세요');
        } else {
          if (revision.price <= 0 || revision.price > 1_000_000 || revision.price % 100 !== 0) {
            throw new IntentionalError('잘못된 가격이에요');
          }
        }
      }

      const password = await match(input.password)
        .with('', () => undefined)
        .with(P.string, (password) => hash(password))
        .with(P.nullish, () => null)
        .exhaustive();

      if (input.password) {
        await redis.del(`Post:${revision.post.id}:passwordUnlock`);
      }

      await database.transaction(async (tx) => {
        await tx.update(PostRevisions).set({ kind: 'PUBLISHED' }).where(eq(PostRevisions.id, input.revisionId));
        await tx
          .update(PostRevisions)
          .set({ kind: 'ARCHIVED' })
          .where(
            and(
              eq(PostRevisions.postId, revision.post.id),
              eq(PostRevisions.kind, 'PUBLISHED'),
              ne(PostRevisions.id, input.revisionId),
            ),
          );

        await tx.delete(PostTags).where(eq(PostTags.postId, revision.post.id));

        for (const { name, kind } of input.tags) {
          const [tag] = await tx.insert(Tags).values({ name }).onConflictDoNothing().returning({ id: Tags.id });
          await tx.insert(PostTags).values({ postId: revision.post.id, tagId: tag.id, kind });
        }

        await tx
          .update(Posts)
          .set({
            state: 'PUBLISHED',
            spaceId: input.spaceId,
            memberId: meAsMember.id,
            publishedAt: revision.post.state === 'PUBLISHED' ? undefined : dayjs(),
            publishedRevisionId: input.revisionId,
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
          })
          .where(eq(Posts.id, revision.post.id));

        if (revision.collectionPost && (!input.collectionId || input.collectionId !== revision.collectionPost.id)) {
          await tx.delete(SpaceCollectionPosts).where(eq(SpaceCollectionPosts.postId, revision.post.id));
          await defragmentSpaceCollectionPosts(tx, revision.collectionPost.collectionId);
        }

        if (input.collectionId && (!revision.collectionPost || input.collectionId !== revision.collectionPost.id)) {
          await tx
            .insert(SpaceCollectionPosts)
            .values({ collectionId: input.collectionId, postId: revision.post.id, order: 2_147_483_647 });
          await defragmentSpaceCollectionPosts(tx, input.collectionId);
        }
      });

      return revision.post.id;
    },
  }),

  updatePostOptions: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: UpdatePostOptionsInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ userId: Posts.userId, space: { id: Spaces.id } })
        .from(Posts)
        .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      const meAsMember = await getSpaceMember(context, post.space.id);
      if (!meAsMember || (post.userId !== context.session.userId && meAsMember.role !== 'ADMIN')) {
        throw new PermissionDeniedError();
      }

      await database
        .update(Posts)
        .set({
          visibility: input.visibility ?? undefined,
          discloseStats: input.discloseStats ?? undefined,
          receiveFeedback: input.receiveFeedback ?? undefined,
          receivePatronage: input.receivePatronage ?? undefined,
          receiveTagContribution: input.receiveTagContribution ?? undefined,
        })
        .where(eq(Posts.id, input.postId));

      return input.postId;
    },
  }),

  updatePostTags: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: UpdatePostTagsInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ userId: Posts.userId, space: { id: Spaces.id } })
        .from(Posts)
        .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      const meAsMember = await getSpaceMember(context, post.space.id);
      if (!meAsMember || (post.userId !== context.session.userId && meAsMember.role !== 'ADMIN')) {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        await tx.delete(PostTags).where(eq(PostTags.postId, input.postId));

        for (const { name, kind } of input.tags) {
          const [tag] = await tx.insert(Tags).values({ name }).onConflictDoNothing().returning({ id: Tags.id });
          await tx.insert(PostTags).values({ postId: input.postId, tagId: tag.id, kind });
        }

        await tx.update(Posts).set({ category: input.category, pairs: input.pairs }).where(eq(Posts.id, input.postId));
      });

      return input.postId;
    },
  }),

  deletePost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: DeletePostInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ userId: Posts.userId, space: { id: Spaces.id } })
        .from(Posts)
        .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      const meAsMember = await getSpaceMember(context, post.space.id);
      if (!meAsMember || (post.userId !== context.session.userId && meAsMember.role !== 'ADMIN')) {
        throw new PermissionDeniedError();
      }

      await database.transaction(async (tx) => {
        await tx.delete(SpaceCollectionPosts).where(eq(SpaceCollectionPosts.postId, input.postId));
        await defragmentSpaceCollectionPosts(tx, post.space.id);

        await tx.update(Posts).set({ state: 'DELETED' }).where(eq(Posts.id, input.postId));
        await tx
          .update(PostRevisions)
          .set({ kind: 'ARCHIVED' })
          .where(and(eq(PostRevisions.postId, input.postId), eq(PostRevisions.kind, 'PUBLISHED')));
      });

      return input.postId;
    },
  }),

  likePost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: LikePostInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .insert(PostLikes)
        .values({
          postId: input.postId,
          userId: context.session.userId,
        })
        .onConflictDoNothing();

      return input.postId;
    },
  }),

  unlikePost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: UnlikePostInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(PostLikes)
        .where(and(eq(PostLikes.postId, input.postId), eq(PostLikes.userId, context.session.userId)));

      return input.postId;
    },
  }),

  purchasePost: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: PurchasePostInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({
          userId: Posts.userId,
          space: { id: Spaces.id },
          revision: { id: PostRevisions.id, price: PostRevisions.price },
        })
        .from(Posts)
        .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
        .innerJoin(PostRevisions, eq(PostRevisions.id, Posts.publishedRevisionId))
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED'), eq(Spaces.state, 'ACTIVE')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.revision.id !== input.revisionId) {
        throw new IntentionalError('포스트 내용이 변경되었어요. 다시 시도해 주세요');
      }

      const price = post.revision.price;
      if (!price) {
        throw new IntentionalError('구매할 수 없는 포스트예요');
      }

      const meAsMember = await getSpaceMember(context, post.space.id);
      if (meAsMember) {
        throw new IntentionalError('자신이 속한 스페이스의 포스트는 구매할 수 없어요');
      }

      const purchases = await database
        .select({ id: PostPurchases.id })
        .from(PostPurchases)
        .where(and(eq(PostPurchases.postId, input.postId), eq(PostPurchases.userId, context.session.userId)));

      if (purchases.length > 0) {
        throw new IntentionalError('이미 구매한 포스트예요');
      }

      await database.transaction(async (tx) => {
        const [purchase] = await tx
          .insert(PostPurchases)
          .values({
            userId: context.session.userId,
            postId: input.postId,
            revisionId: post.revision.id,
            pointAmount: price,
          })
          .returning({ id: PostPurchases.id });

        await deductUserPoint({
          tx,
          userId: context.session.userId,
          amount: price,
          targetId: purchase.id,
          cause: 'UNLOCK_CONTENT',
        });

        await tx.insert(Revenues).values({
          userId: post.userId,
          amount: price,
          targetId: purchase.id,
          kind: 'POST_PURCHASE',
          state: 'PENDING',
        });
      });

      const masquerade = await makeMasquerade({
        userId: context.session.userId,
        spaceId: post.space.id,
      });

      await createNotification({
        userId: post.userId,
        category: 'PURCHASE',
        actorId: masquerade.profileId,
        data: { postId: input.postId },
        origin: context.event.url.origin,
      });

      return input.postId;
    },
  }),

  updatePostView: t.field({
    type: Post,
    args: { input: t.arg({ type: UpdatePostViewInput }) },
    resolve: async (_, { input }, context) => {
      const views = await database
        .select({ id: PostViews.id })
        .from(PostViews)
        .where(
          and(
            eq(PostViews.postId, input.postId),
            context.session ? eq(PostViews.userId, context.session.userId) : eq(PostViews.deviceId, context.deviceId),
          ),
        );

      if (views.length > 0) {
        await database
          .update(PostViews)
          .set({ deviceId: context.deviceId, viewedAt: dayjs() })
          .where(eq(PostViews.id, views[0].id));
      } else {
        await database.insert(PostViews).values({
          postId: input.postId,
          userId: context.session?.userId,
          deviceId: context.deviceId,
        });

        await redis.incr(`Post:${input.postId}:viewCount`);
      }

      return input.postId;
    },
  }),

  createPostReaction: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: CreatePostReactionInput }) },
    resolve: async (_, { input }, context) => {
      if (!emojiData.emojis[input.emoji]) {
        throw new IntentionalError('잘못된 이모지예요');
      }

      const posts = await database
        .select({ receiveFeedback: Posts.receiveFeedback })
        .from(Posts)
        .where(eq(Posts.id, input.postId));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      if (!posts[0].receiveFeedback) {
        throw new IntentionalError('피드백을 받지 않는 포스트예요');
      }

      await database
        .insert(PostReactions)
        .values({
          userId: context.session.userId,
          postId: input.postId,
          emoji: input.emoji,
        })
        .onConflictDoNothing();

      return input.postId;
    },
  }),

  deletePostReaction: t.withAuth({ user: true }).field({
    type: Post,
    args: { input: t.arg({ type: DeletePostReactionInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(PostReactions)
        .where(
          and(
            eq(PostReactions.postId, input.postId),
            eq(PostReactions.userId, context.session.userId),
            eq(PostReactions.emoji, input.emoji),
          ),
        );

      return input.postId;
    },
  }),

  unlockPasswordedPost: t.field({
    type: Post,
    args: { input: t.arg({ type: UnlockPasswordedPostInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database.select({ password: Posts.password }).from(Posts).where(eq(Posts.id, input.postId));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      if (posts[0].password) {
        if (!(await verify(posts[0].password, input.password))) {
          throw new FormValidationError('password', '잘못된 비밀번호예요');
        }

        await redis.hset(`Post:${input.postId}:passwordUnlock`, context.deviceId, dayjs().add(1, 'hour').toISOString());
        await redis.expire(`Post:${input.postId}:passwordUnlock`, 60 * 60);
      }

      return input.postId;
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
