import type { Cache, Data } from '@urql/exchange-graphcache';
import type { GraphCacheConfig } from '$glitch';

const me = (cache: Cache) => cache.resolve('Query', 'me') as Data;

export const updates: GraphCacheConfig['updates'] = {
  Mutation: {
    createSpace: (_, __, cache) => {
      cache.invalidate(me(cache), 'spaces');
    },
    deleteSpace: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Space', id: input.spaceId });
    },
    followSpace: (_, __, cache) => {
      cache.invalidate(me(cache), 'followedSpaces');
    },
    unfollowSpace: (_, __, cache) => {
      cache.invalidate(me(cache), 'followedSpaces');
    },
    updatePostOptions: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Post', id: input.postId });
    },
    deletePost: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Post', id: input.postId });
    },
    muteSpace: (_, __, cache) => {
      cache.invalidate(me(cache), 'mutedSpaces');
    },
    unmuteSpace: (_, __, cache) => {
      cache.invalidate(me(cache), 'mutedSpaces');
    },
    unmuteTag: (_, __, cache) => {
      cache.invalidate(me(cache), 'mutedTags');
    },
    unfollowTag: (_, __, cache) => {
      cache.invalidate(me(cache), 'followedTags');
    },
    unbookmarkPost: (_, __, cache) => {
      cache.invalidate(me(cache), 'bookmarkGroups');
    },
    createSpaceCollection: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Space', id: input.spaceId });
    },
    deleteSpaceCollection: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'SpaceCollection', id: input.spaceCollectionId });
    },
    setSpaceCollectionPosts: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'SpaceCollection', id: input.spaceCollectionId });
    },
    createComment: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Post', id: input.postId });
    },
    deleteComment: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'PostComment', id: input.commentId });
    },
    blockMasquerade: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Space', id: input.spaceId });
    },
    unblockMasquerade: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'Space', id: input.spaceId });
    },
    pinComment: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'PostComment', id: input.commentId });
    },
    unpinComment: (_, { input }, cache) => {
      cache.invalidate({ __typename: 'PostComment', id: input.commentId });
    },
  },
};
