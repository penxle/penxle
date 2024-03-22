import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import { and, eq } from 'drizzle-orm';
import stringify from 'fast-json-stable-stringify';
import { nanoid } from 'nanoid';
import * as R from 'radash';
import { redis } from './cache';
import { database, Users, UserSessions } from './database';
import { decodeAccessToken } from './utils/access-token';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserRole } from '$lib/enums';

type LoaderParams<T, R, S, N extends boolean, M extends boolean> = {
  name: string;
  nullable?: N;
  many?: M;
  key: (value: N extends true ? R | null : R) => N extends true ? S | null : S;
  load: (keys: T[]) => Promise<R[]>;
};

type DefaultContext = {
  'event': RequestEvent;

  'deviceId': string;

  'flash': (type: 'success' | 'error', message: string) => Promise<void>;

  'loader': <T, R, S, N extends boolean = false, M extends boolean = false, RR = N extends true ? R | null : R>(
    params: LoaderParams<T, R, S, N, M>,
  ) => DataLoader<T, M extends true ? RR[] : RR, string>;
  ' $loaders': Map<string, DataLoader<unknown, unknown>>;
};

export type UserContext = {
  session: {
    id: string;
    userId: string;
    profileId: string;
    role: keyof typeof UserRole;
  };
};

export type Context = DefaultContext & Partial<UserContext>;

export const createContext = async (event: RequestEvent): Promise<Context> => {
  let deviceId = event.cookies.get('penxle-did');
  if (!deviceId) {
    deviceId = nanoid(32);
    event.cookies.set('penxle-did', deviceId, {
      path: '/',
      maxAge: dayjs.duration(1, 'year').asSeconds(),
    });
  }

  const ctx: Context = {
    event,
    deviceId,
    'flash': async (type: 'success' | 'error', message: string) => {
      await redis.setex(`flash:${deviceId}`, 30, JSON.stringify({ type, message }));
    },
    'loader': <
      T,
      R,
      S,
      N extends boolean = false,
      M extends boolean = false,
      RR = N extends true ? R | null : R,
      F = M extends true ? RR[] : RR,
    >({
      name,
      nullable,
      many,
      load,
      key,
    }: LoaderParams<T, R, S, N, M>) => {
      const cached = ctx[' $loaders'].get(name);
      if (cached) {
        return cached as DataLoader<T, F, string>;
      }

      const loader = new DataLoader<T, F, string>(
        async (keys) => {
          const rows = await load(keys as T[]);
          const values = R.group(rows, (row) => stringify(key(row)));
          return keys.map((key) => {
            const value = values[stringify(key)];

            if (value?.length) {
              return many ? value : value[0];
            }

            if (nullable) {
              return null;
            }

            if (many) {
              return [];
            }

            return new Error('DataLoader: Missing key');
          }) as (F | Error)[];
        },
        { cacheKeyFn: (key) => stringify(key) },
      );

      ctx[' $loaders'].set(name, loader);

      return loader;
    },
    ' $loaders': new Map(),
  };

  const accessToken = event.cookies.get('penxle-at');
  if (accessToken) {
    let sessionId: string | undefined;

    try {
      sessionId = await decodeAccessToken(accessToken);
    } catch {
      // noop
    }

    if (sessionId) {
      const sessions = await database
        .select({ id: UserSessions.id, userId: Users.id, profileId: Users.profileId, role: Users.role })
        .from(UserSessions)
        .innerJoin(Users, eq(Users.id, UserSessions.userId))
        .where(and(eq(UserSessions.id, sessionId), eq(Users.state, 'ACTIVE')));

      if (sessions.length > 0) {
        ctx.session = sessions[0];
      }
    }
  }

  return ctx;
};
