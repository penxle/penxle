import { builder } from '../builder';

/**
 * * Queries
 */

builder.queryFields((t) => ({
  hello: t.string({
    args: { name: t.arg.string() },
    resolve: (_, args) => `Hello, ${args.name}`,
  }),
}));
