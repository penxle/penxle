import dayjs from 'dayjs';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { status } from 'itty-router';
import { nanoid } from 'nanoid';
import qs from 'query-string';
import * as R from 'radash';
import {
  database,
  Posts,
  ProvisionedUsers,
  SpaceMembers,
  Spaces,
  UserEventEnrollments,
  Users,
  UserSessions,
  UserSingleSignOns,
} from '$lib/server/database';
import { google, naver, twitter } from '$lib/server/external-api';
import { createAccessToken, useFirstRow, useFirstRowOrThrow } from '$lib/server/utils';
import { base36To10 } from '$lib/utils';
import { createRouter } from '../router';
import type { Context } from '$lib/server/context';
import type { TwitterUser } from '$lib/server/external-api/twitter';
import type { ExternalUser } from '$lib/server/external-api/types';

const penxleSpaceRegex = /^(?:penxle\.com|pencil\.so)\/([\d_a-z][\d._a-z]*[\d_a-z])/;
const penxleShortlinkRegex = /^pnxl\.me\/([\da-z]+)/;

export const sso = createRouter();
type State = { type: string };

sso.get('/sso/google', async (_, context) => {
  const code = context.event.url.searchParams.get('code');
  if (!code) {
    throw new Error('code is required');
  }

  const externalUser = await google.authorizeUser(context.event, code);
  return await handle(context, externalUser);
});

sso.get('/sso/naver', async (_, context) => {
  const code = context.event.url.searchParams.get('code');
  if (!code) {
    throw new Error('code is required');
  }

  const externalUser = await naver.authorizeUser(code);
  return await handle(context, externalUser);
});

sso.get('/sso/twitter', async (_, context) => {
  const token = context.event.url.searchParams.get('oauth_token');
  const verifier = context.event.url.searchParams.get('oauth_verifier');
  if (!token || !verifier) {
    throw new Error('oauth_token and oauth_verifier is required');
  }

  const externalUser = await twitter.authorizeUser(token, verifier);
  return await handle(context, externalUser);
});

const processLink = async ({ userId, links }: { userId: string; links: string[] }) => {
  const spaceLinks = R.sift(links.map((link) => link.match(penxleSpaceRegex)?.[1]));
  if (spaceLinks.length > 0) {
    const isLinked = await database
      .select({ id: SpaceMembers.id })
      .from(SpaceMembers)
      .innerJoin(Spaces, eq(Spaces.id, SpaceMembers.spaceId))
      .where(
        and(
          eq(SpaceMembers.userId, userId),
          eq(SpaceMembers.state, 'ACTIVE'),
          inArray(Spaces.slug, spaceLinks),
          eq(Spaces.state, 'ACTIVE'),
          eq(Spaces.visibility, 'PUBLIC'),
        ),
      )
      .then((rows) => rows.length > 0);

    if (isLinked) {
      await database
        .insert(UserEventEnrollments)
        .values({
          userId,
          eventCode: 'twitter_spacelink_2024',
          eligible: true,
        })
        .onConflictDoUpdate({
          target: [UserEventEnrollments.userId, UserEventEnrollments.eventCode],
          set: { eligible: true },
        });
      return;
    }
  }

  const shortLinks = R.sift(links.map((link) => link.match(penxleShortlinkRegex)?.[1]));
  if (shortLinks.length > 0) {
    const isLinked = await database
      .select({ id: Posts.id })
      .from(Posts)
      .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
      .where(
        and(
          inArray(
            Posts.permalink,
            shortLinks.map((shortLink) => base36To10(shortLink)),
          ),
          eq(Posts.userId, userId),
          eq(Posts.state, 'PUBLISHED'),
          eq(Posts.visibility, 'PUBLIC'),
          isNull(Posts.password),
          eq(Spaces.state, 'ACTIVE'),
          eq(Spaces.visibility, 'PUBLIC'),
        ),
      );

    if (isLinked) {
      await database
        .insert(UserEventEnrollments)
        .values({
          userId,
          eventCode: 'twitter_spacelink_2024',
          eligible: true,
        })
        .onConflictDoUpdate({
          target: [UserEventEnrollments.userId, UserEventEnrollments.eventCode],
          set: { eligible: true },
        });

      return;
    }
  }

  // 필요하면 여기서 자격없음 처리
};

const handle = async (context: Context, externalUser: ExternalUser & Partial<TwitterUser>) => {
  const _state = context.event.url.searchParams.get('state');
  if (!_state) {
    throw new Error('state is required');
  }

  const state = JSON.parse(Buffer.from(_state, 'base64').toString()) as State;

  const sso = await database
    .select({ userId: UserSingleSignOns.userId })
    .from(UserSingleSignOns)
    .where(eq(eq(UserSingleSignOns.provider, externalUser.provider), eq(UserSingleSignOns.principal, externalUser.id)))
    .then(useFirstRow);

  // 하나의 핸들러로 여러가지 기능을 처리하기에 케이스 분리가 필요함.

  if (state.type === 'LINK') {
    // 케이스 1: 계정 연동중인 경우

    if (!context.session) {
      // 케이스 1 (fail): 현재 사이트에 로그인이 되어 있지 않은 상태
      // -> 에러
      // 일반적인 케이스에서는 세션이 만료되었을때?

      return status(303, { headers: { Location: '/login' } });
    }

    if (sso) {
      // 케이스 1-1: 콜백이 날아온 계정이 이미 사이트의 "누군가에게" 연동이 되어 있는 경우

      if (sso.userId === context.session.userId) {
        // 케이스 1-1-1: 그 "누군가"가 현재 로그인된 본인인 경우
        // -> 이미 로그인도 되어 있고 연동도 되어 있으니 아무것도 하지 않음

        if (externalUser.links) {
          await processLink({ userId: context.session.userId, links: externalUser.links });
        }

        return status(303, { headers: { Location: '/me/settings' } });
      } else {
        // 케이스 1-1-2: 그 "누군가"가 현재 로그인된 본인이 아닌 경우
        // -> 현재 로그인된 세션과 연동된 계정이 다르므로 에러

        return status(303, {
          headers: {
            Location: qs.stringifyUrl({
              url: '/me/settings',
              query: { message: 'sso_already_linked_by_other' },
            }),
          },
        });
      }
    } else {
      // 케이스 1-2: 콜백이 날아온 계정이 아직 사이트에 연동이 안 된 계정인 경우
      // -> 현재 로그인한 계정에 콜백이 날아온 계정을 연동함

      await database.insert(UserSingleSignOns).values({
        userId: context.session.userId,
        provider: externalUser.provider,
        principal: externalUser.id,
        email: externalUser.email,
      });

      if (externalUser.links) {
        await processLink({ userId: context.session.userId, links: externalUser.links });
      }

      return status(303, { headers: { Location: '/me/settings' } });
    }
  } else if (state.type === 'LOGIN') {
    // 케이스 2: 계정 로그인 혹은 가입중인 경우

    if (sso) {
      // 케이스 2-1: 콜백이 날아온 계정이 이미 사이트의 "누군가에게" 연동이 되어 있는 경우
      // -> 그 "누군가"로 로그인함

      // const session = await db.userSession.create({
      //   data: { id: createId(), userId: sso.userId },
      // });

      const session = await database
        .insert(UserSessions)
        .values({ userId: sso.userId })
        .returning({ id: UserSessions.id })
        .then(useFirstRowOrThrow());

      const accessToken = await createAccessToken(session.id);
      context.event.cookies.set('penxle-at', accessToken, {
        path: '/',
        maxAge: dayjs.duration(1, 'year').asSeconds(),
      });

      return status(303, { headers: { Location: '/' } });
    } else {
      // 케이스 2-2: 콜백이 날아온 계정이 아직 사이트에 연동이 안 된 계정인 경우

      const user = await database
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, externalUser.email.toLowerCase()), eq(Users.state, 'ACTIVE')))
        .then(useFirstRow);

      if (user) {
        // 케이스 2-2-1: 콜백이 날아온 계정의 이메일과 같은 이메일의 계정이 이미 사이트에 있으나, 연동이 안 된 경우
        // -> 자동으로 기존 계정에 연동 & 로그인해줌

        await database.insert(UserSingleSignOns).values({
          userId: user.id,
          provider: externalUser.provider,
          principal: externalUser.id,
          email: externalUser.email,
        });

        const session = await database
          .insert(UserSessions)
          .values({ userId: user.id })
          .returning({ id: UserSessions.id })
          .then(useFirstRowOrThrow());

        const accessToken = await createAccessToken(session.id);
        context.event.cookies.set('penxle-at', accessToken, {
          path: '/',
          maxAge: dayjs.duration(1, 'year').asSeconds(),
        });

        return status(303, { headers: { Location: '/' } });
      } else {
        // 케이스 2-2-2: 콜백이 날아온 계정의 이메일이 연동되지 않았고, 같은 이메일의 계정도 사이트에 없는 경우
        // -> 가입 페이지로 보냄

        const token = nanoid();

        await database.insert(ProvisionedUsers).values({
          email: externalUser.email,
          token,
          name: externalUser.name,
          avatarUrl: externalUser.avatarUrl,
          provider: externalUser.provider,
          principal: externalUser.id,
        });

        return status(303, {
          headers: {
            Location: qs.stringifyUrl({
              url: '/signup',
              query: { token },
            }),
          },
        });
      }
    }
  }

  // 여기까지 오면 안 됨
  throw new Error('should not reach here');
};
