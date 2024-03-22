import { builder } from '../builder';
import { Post } from './post';
import { Tag } from './tag';

/**
 * * Queries
 */

builder.queryFields((t) => ({
  recommendFeed: t.field({
    type: [Post],
    resolve: async () => {
      return [];
    },
  }),

  recentFeed: t.field({
    type: [Post],
    resolve: async () => {
      return [];
    },
  }),

  tagFeed: t.withAuth({ user: true }).field({
    type: [Post],
    resolve: async () => {
      return [];
    },
  }),

  spaceFeed: t.withAuth({ user: true }).field({
    type: [Post],
    resolve: async () => {
      return [];
    },
  }),

  recentlyUsedTags: t.field({
    type: [Tag],
    resolve: async () => {
      return [];
    },
  }),
}));
