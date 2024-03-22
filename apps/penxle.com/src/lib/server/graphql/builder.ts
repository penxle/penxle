import SchemaBuilder from '@pothos/core';
import DataLoaderPlugin from '@pothos/plugin-dataloader';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import ValidationPlugin from '@pothos/plugin-validation';
import dayjs from 'dayjs';
import { GraphQLJSON, GraphQLVoid } from 'graphql-scalars';
import { dev } from '$app/environment';
import { PermissionDeniedError } from '$lib/errors';
import type { Context, UserContext } from '../context';

if (dev) {
  import('./schemas');
}

export const builder = new SchemaBuilder<{
  AuthContexts: {
    admin: Context & UserContext;
    user: Context & UserContext;
  };
  AuthScopes: {
    admin: boolean;
    user: boolean;
  };
  Context: Context;
  DefaultInputFieldRequiredness: true;
  Scalars: {
    DateTime: { Input: dayjs.Dayjs; Output: dayjs.Dayjs };
    ID: { Input: string; Output: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSON: { Input: any; Output: unknown };
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    Void: { Input: never; Output: void };
  };
}>({
  authScopes: (context) => ({
    admin: context.session?.role === 'ADMIN',
    user: !!context.session,
  }),
  defaultInputFieldRequiredness: true,
  plugins: [ScopeAuthPlugin, DataLoaderPlugin, SimpleObjectsPlugin, ValidationPlugin],
  scopeAuthOptions: {
    treatErrorsAsUnauthorized: true,
    unauthorizedError: () => new PermissionDeniedError(),
  },
});

builder.queryType();
builder.mutationType();

builder.addScalarType('JSON', GraphQLJSON);
builder.addScalarType('Void', GraphQLVoid);

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value === 'string') {
      const d = dayjs(value);
      if (d.isValid()) {
        return d;
      }
    }

    throw new Error('Invalid date time value');
  },
});

export type Builder = typeof builder;
