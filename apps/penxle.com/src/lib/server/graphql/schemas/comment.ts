import dayjs from 'dayjs';
import { and, count, eq } from 'drizzle-orm';
import { PostCommentState, PostCommentVisibility } from '$lib/enums';
import { NotFoundError, PermissionDeniedError } from '$lib/errors';
import {
  database,
  PostCommentLikes,
  PostComments,
  PostPurchases,
  Posts,
  SpaceMasquerades,
  UserPersonalIdentities,
} from '$lib/server/database';
import { createNotification, getSpaceMember, makeMasquerade } from '$lib/server/utils';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { SpaceMasquerade } from './space';
import { Profile } from './user';

/**
 * * Types
 */

export const PostComment = createObjectRef('PostComment', PostComments);
PostComment.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    content: t.exposeString('content'),
    pinned: t.exposeBoolean('pinned'),
    visibility: t.expose('visibility', { type: PostCommentVisibility }),
    state: t.expose('state', { type: PostCommentState }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime', nullable: true }),

    profile: t.field({
      type: Profile,
      resolve: (postComment) => postComment.profileId,
    }),

    masquerade: t.field({
      type: SpaceMasquerade,
      nullable: true,
      resolve: async (postComment) => {
        const rows = await database
          .select({ id: SpaceMasquerades.id })
          .from(SpaceMasquerades)
          .where(eq(SpaceMasquerades.profileId, postComment.profileId));

        if (rows.length === 0) {
          return null;
        }

        return rows[0].id;
      },
    }),

    liked: t.boolean({
      resolve: async (postComment, _, context) => {
        if (!context.session) {
          return false;
        }

        const rows = await database
          .select({ id: PostCommentLikes.id })
          .from(PostCommentLikes)
          .where(
            and(eq(PostCommentLikes.commentId, postComment.id), eq(PostCommentLikes.userId, context.session.userId)),
          );

        return rows.length > 0;
      },
    }),

    likedByPostUser: t.boolean({
      resolve: async (postComment) => {
        const posts = database
          .select({ userId: Posts.userId })
          .from(Posts)
          .where(eq(Posts.id, postComment.postId))
          .as('sq');

        const rows = await database
          .select({ id: PostCommentLikes.id })
          .from(PostCommentLikes)
          .where(and(eq(PostCommentLikes.commentId, postComment.id), eq(PostCommentLikes.userId, posts.userId)));

        return rows.length > 0;
      },
    }),

    likeCount: t.int({
      resolve: async (postComment) => {
        const rows = await database
          .select({ count: count() })
          .from(PostCommentLikes)
          .where(eq(PostCommentLikes.commentId, postComment.id));

        return rows[0].count;
      },
    }),

    purchased: t.boolean({
      resolve: async (postComment) => {
        const rows = await database
          .select({ id: PostPurchases.id })
          .from(PostPurchases)
          .where(and(eq(PostPurchases.postId, postComment.postId), eq(PostPurchases.userId, postComment.userId)));

        return rows.length > 0;
      },
    }),

    parent: t.field({
      type: PostComment,
      nullable: true,
      resolve: (postComment) => postComment.parentId,
    }),

    children: t.field({
      type: [PostComment],
      resolve: async (postComment) => {
        const rows = await database
          .select({ id: PostComments.id })
          .from(PostComments)
          .where(and(eq(PostComments.parentId, postComment.id), eq(PostComments.state, 'ACTIVE')));

        return rows.map((row) => row.id);
      },
    }),
  }),
});

/**
 * * Inputs
 */

const CreateCommentInput = builder.inputType('CreateCommentInput', {
  fields: (t) => ({
    content: t.string(),
    parentId: t.id({ required: false }),
    postId: t.id(),
    visibility: t.field({ type: PostCommentVisibility }),
  }),
});

const DeleteCommentInput = builder.inputType('DeleteCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
  }),
});

const UpdateCommentInput = builder.inputType('UpdateCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
    content: t.string(),
  }),
});

const PinCommentInput = builder.inputType('PinCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
  }),
});

const UnpinCommentInput = builder.inputType('UnpinCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
  }),
});

const LikeCommentInput = builder.inputType('LikeCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
  }),
});

const UnlikeCommentInput = builder.inputType('UnlikeCommentInput', {
  fields: (t) => ({
    commentId: t.id(),
  }),
});

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  createComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: CreateCommentInput }) },
    resolve: async (_, { input }, context) => {
      const posts = await database
        .select({ userId: Posts.userId, spaceId: Posts.spaceId, commentQualification: Posts.commentQualification })
        .from(Posts)
        .where(and(eq(Posts.id, input.postId), eq(Posts.state, 'PUBLISHED')));

      if (posts.length === 0) {
        throw new NotFoundError();
      }

      const [post] = posts;

      if (post.commentQualification === 'NONE') {
        throw new PermissionDeniedError();
      }

      if (post.commentQualification === 'IDENTIFIED') {
        const rows = await database
          .select({ id: UserPersonalIdentities.id })
          .from(UserPersonalIdentities)
          .where(eq(UserPersonalIdentities.userId, context.session.userId));

        if (rows.length === 0) {
          throw new PermissionDeniedError();
        }
      }

      let notificationTargetUserId;

      if (input.parentId) {
        const rows = await database
          .select()
          .from(PostComments)
          .where(
            and(
              eq(PostComments.id, input.parentId),
              eq(PostComments.postId, input.postId),
              eq(PostComments.state, 'ACTIVE'),
            ),
          );

        if (rows.length === 0) {
          throw new NotFoundError();
        }

        notificationTargetUserId = rows[0].userId;
      } else {
        notificationTargetUserId = post.userId;
      }

      let profileId: string;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const spaceMember = await getSpaceMember(context, post.spaceId!);
      if (spaceMember) {
        profileId = spaceMember.profileId;
      } else {
        const masquerade = await makeMasquerade({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          spaceId: post.spaceId!,
          userId: context.session.userId,
        });

        if (masquerade.blockedAt) {
          throw new PermissionDeniedError();
        }

        profileId = masquerade.profileId;
      }

      return await database.transaction(async (tx) => {
        const [comment] = await tx
          .insert(PostComments)
          .values({
            postId: input.postId,
            userId: context.session.userId,
            profileId,
            parentId: input.parentId,
            content: input.content,
            visibility: input.visibility,
            state: 'ACTIVE',
          })
          .returning({ id: PostComments.id });

        if (notificationTargetUserId !== context.session.userId) {
          await createNotification({
            userId: notificationTargetUserId,
            category: 'COMMENT',
            actorId: profileId,
            data: { commentId: comment.id },
            origin: context.event.url.origin,
          });
        }

        return comment.id;
      });
    },
  }),

  deleteComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: DeleteCommentInput }) },
    resolve: async (_, { input }, context) => {
      const comments = await database
        .select({ userId: PostComments.userId, post: { userId: Posts.userId, spaceId: Posts.spaceId } })
        .from(PostComments)
        .innerJoin(Posts, eq(PostComments.postId, Posts.id))
        .where(and(eq(PostComments.id, input.commentId), eq(PostComments.state, 'ACTIVE')));

      if (comments.length === 0) {
        throw new NotFoundError();
      }

      const [comment] = comments;

      const masquerade = await makeMasquerade({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        spaceId: comment.post.spaceId!,
        userId: context.session.userId,
      });

      if (masquerade.blockedAt) {
        throw new PermissionDeniedError();
      }

      // 댓글을 삭제할 권한이 있나요?
      // 1. 댓글 작성자 자신
      // 2. 포스트 작성자
      if (comment.userId !== context.session.userId && comment.post.userId !== context.session.userId) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const meAsMember = await getSpaceMember(context, comment.post.spaceId!);

        if (meAsMember?.role !== 'ADMIN') {
          throw new PermissionDeniedError();
        }
      }

      await database
        .update(PostComments)
        .set({ state: 'INACTIVE', pinned: false })
        .where(eq(PostComments.id, input.commentId));

      return input.commentId;
    },
  }),

  updateComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: UpdateCommentInput }) },
    resolve: async (_, { input }, context) => {
      const comments = await database
        .select({ userId: PostComments.userId, post: { userId: Posts.userId, spaceId: Posts.spaceId } })
        .from(PostComments)
        .innerJoin(Posts, eq(PostComments.postId, Posts.id))
        .where(
          and(
            eq(PostComments.id, input.commentId),
            eq(PostComments.state, 'ACTIVE'),
            eq(PostComments.userId, context.session.userId),
          ),
        );

      if (comments.length === 0) {
        throw new NotFoundError();
      }

      const [comment] = comments;

      const masquerade = await makeMasquerade({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        spaceId: comment.post.spaceId!,
        userId: context.session.userId,
      });

      if (masquerade.blockedAt) {
        throw new PermissionDeniedError();
      }

      await database.update(PostComments).set({
        content: input.content,
        updatedAt: dayjs(),
      });

      return input.commentId;
    },
  }),

  pinComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: PinCommentInput }) },
    resolve: async (_, { input }, context) => {
      const comments = await database
        .select({ post: { id: Posts.id, userId: Posts.userId, spaceId: Posts.spaceId } })
        .from(PostComments)
        .innerJoin(Posts, eq(PostComments.postId, Posts.id))
        .where(and(eq(PostComments.id, input.commentId), eq(PostComments.state, 'ACTIVE')));

      if (comments.length === 0) {
        throw new NotFoundError();
      }

      const [comment] = comments;

      if (comment.post.userId !== context.session.userId) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const meAsMember = await getSpaceMember(context, comment.post.spaceId!);
        if (meAsMember?.role !== 'ADMIN') {
          throw new PermissionDeniedError();
        }
      }

      // 지금은 댓글 고정 1개만 가능

      await database.transaction(async (tx) => {
        await tx
          .update(PostComments)
          .set({ pinned: false })
          .where(and(eq(PostComments.postId, comment.post.id), eq(PostComments.pinned, true)));

        await tx.update(PostComments).set({ pinned: true }).where(eq(PostComments.id, input.commentId));
      });

      return input.commentId;
    },
  }),

  unpinComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: UnpinCommentInput }) },
    resolve: async (_, { input }, context) => {
      const comments = await database
        .select({ post: { id: Posts.id, userId: Posts.userId, spaceId: Posts.spaceId } })
        .from(PostComments)
        .innerJoin(Posts, eq(PostComments.postId, Posts.id))
        .where(and(eq(PostComments.id, input.commentId), eq(PostComments.state, 'ACTIVE')));

      if (comments.length === 0) {
        throw new NotFoundError();
      }

      const [comment] = comments;

      if (comment.post.userId !== context.session.userId) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const meAsMember = await getSpaceMember(context, comment.post.spaceId!);
        if (meAsMember?.role !== 'ADMIN') {
          throw new PermissionDeniedError();
        }
      }

      await database.update(PostComments).set({ pinned: false }).where(eq(PostComments.id, input.commentId));

      return input.commentId;
    },
  }),

  likeComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: LikeCommentInput }) },
    resolve: async (_, { input }, context) => {
      const comments = await database
        .select({ post: { id: Posts.id, userId: Posts.userId, spaceId: Posts.spaceId } })
        .from(PostComments)
        .innerJoin(Posts, eq(PostComments.postId, Posts.id))
        .where(and(eq(PostComments.id, input.commentId), eq(PostComments.state, 'ACTIVE')));

      if (comments.length === 0) {
        throw new NotFoundError();
      }

      const [comment] = comments;

      let profileId: string;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const spaceMember = await getSpaceMember(context, comment.post.spaceId!);
      if (spaceMember) {
        profileId = spaceMember.profileId;
      } else {
        const masquerade = await makeMasquerade({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          spaceId: comment.post.spaceId!,
          userId: context.session.userId,
        });

        if (masquerade.blockedAt) {
          throw new PermissionDeniedError();
        }

        profileId = masquerade.profileId;
      }

      await database
        .insert(PostCommentLikes)
        .values({
          commentId: input.commentId,
          userId: context.session.userId,
          profileId,
        })
        .onConflictDoNothing();

      return input.commentId;
    },
  }),

  unlikeComment: t.withAuth({ user: true }).field({
    type: PostComment,
    args: { input: t.arg({ type: UnlikeCommentInput }) },
    resolve: async (_, { input }, context) => {
      await database
        .delete(PostCommentLikes)
        .where(
          and(eq(PostCommentLikes.commentId, input.commentId), eq(PostCommentLikes.userId, context.session.userId)),
        );

      return input.commentId;
    },
  }),
}));
