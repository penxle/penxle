import { track } from '../analytics';
import { prismaClient } from '../database';
import { decodeAccessToken } from '../utils/access-token';
import type { TransactionClient } from '../prisma/transaction';
import type { RequestEvent } from '@sveltejs/kit';
import type { YogaInitialContext } from 'graphql-yoga';
import type { JWTPayload } from 'jose';

type DefaultContext = {
  db: TransactionClient;
  track: (eventName: string, properties?: Record<string, unknown>) => void;
};

export type AuthContext = {
  session: {
    id: string;
    userId: string;
    profileId: string;
  };
};

type ExtendedContext = App.Locals & DefaultContext & Partial<AuthContext>;
type InitialContext = YogaInitialContext & RequestEvent;
export type Context = InitialContext & ExtendedContext;

export const extendContext = async (
  context: InitialContext
): Promise<ExtendedContext> => {
  const db = await prismaClient.$begin({ isolation: 'RepeatableRead' });

  const ctx: ExtendedContext = {
    ...context.locals,
    db,
    track: (eventName, properties) => {
      track(context, eventName, { ...properties });
    },
  };

  const accessToken = context.cookies.get('penxle-at');
  if (accessToken) {
    let payload: JWTPayload | undefined;

    try {
      payload = await decodeAccessToken(accessToken);
    } catch {
      // noop
    }

    if (payload) {
      const sessionId = payload.jti;

      if (sessionId) {
        const session = await db.session.findUnique({
          select: { userId: true, profileId: true },
          where: { id: sessionId },
        });

        if (session) {
          ctx.session = {
            id: sessionId,
            userId: session.userId,
            profileId: session.profileId,
          };

          ctx.track = (eventName, properties) => {
            track(context, eventName, {
              $user_id: session.userId,
              ...properties,
            });
          };
        }
      }
    }
  }

  return ctx;
};
