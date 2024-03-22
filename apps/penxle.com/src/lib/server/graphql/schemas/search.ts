import { builder } from '../builder';
import { Post } from './post';
import { Space } from './space';
import { Tag } from './tag';
import type { SearchResponse } from '$lib/server/utils';

/**
 * * Types
 */

const OrderByKind = builder.enumType('SearchOrderByKind', {
  values: ['ACCURACY', 'LATEST'],
});

class SearchResult {
  result!: SearchResponse;
}

builder.objectType(SearchResult, {
  name: 'SearchResult',
  fields: (t) => ({
    count: t.field({
      type: 'Int',
      resolve: ({ result }) => {
        const total = result.hits.total;
        if (typeof total === 'number') return total;
        return total?.value ?? 0;
      },
    }),

    posts: t.field({
      type: [Post],
      resolve: async () => {
        return [];
      },
    }),
  }),
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  searchPosts: t.field({
    type: SearchResult,
    args: {
      query: t.arg.string(),
      includeTags: t.arg.stringList({ defaultValue: [] }),
      excludeTags: t.arg.stringList({ defaultValue: [] }),
      adultFilter: t.arg.boolean({ required: false }),
      orderBy: t.arg({ type: OrderByKind, defaultValue: 'ACCURACY' }),
      page: t.arg.int({ defaultValue: 1 }),
    },
    resolve: async () => {
      return {
        result: { hits: { hits: [] }, _shards: { total: 0, successful: 0, failed: 0 }, timed_out: false, took: 0 },
      };
    },
  }),

  searchSpaces: t.field({
    type: [Space],
    args: { query: t.arg.string() },
    resolve: async () => {
      return [];
    },
  }),

  searchTags: t.field({
    type: [Tag],
    args: { query: t.arg.string() },
    resolve: async () => {
      return [];
    },
  }),
}));
