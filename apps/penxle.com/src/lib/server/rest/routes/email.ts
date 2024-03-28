import dayjs from 'dayjs';
import { and, eq, gte } from 'drizzle-orm';
import { status } from 'itty-router';
import { nanoid } from 'nanoid';
import qs from 'query-string';
import {
  database,
  Profiles,
  ProvisionedUsers,
  UserEmailVerifications,
  Users,
  UserSessions,
} from '$lib/server/database';
import { sendEmail } from '$lib/server/email';
import { UserEmailUpdated } from '$lib/server/email/templates';
import { createAccessToken } from '$lib/server/utils';
import { createRouter } from '../router';

export const email = createRouter();

email.get('/email', async (_, context) => {
  const token = context.event.url.searchParams.get('token');
  if (!token) {
    throw new Error('token is required');
  }

  return await database.transaction(async (tx) => {
    const userEmailVerifications = await tx
      .select({
        id: UserEmailVerifications.id,
        userId: UserEmailVerifications.userId,
        kind: UserEmailVerifications.kind,
        email: UserEmailVerifications.email,
      })
      .from(UserEmailVerifications)
      .where(and(eq(UserEmailVerifications.token, token), gte(UserEmailVerifications.expiresAt, dayjs())));

    if (userEmailVerifications.length === 0) {
      throw new Error('invalid token');
    }

    const [userEmailVerification] = userEmailVerifications;

    await tx.delete(UserEmailVerifications).where(eq(UserEmailVerifications.id, userEmailVerification.id));

    if (userEmailVerification.kind === 'USER_LOGIN') {
      const users = await tx
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, userEmailVerification.email.toLowerCase()), eq(Users.state, 'ACTIVE')));

      if (users.length > 0) {
        const [session] = await tx
          .insert(UserSessions)
          .values({ userId: users[0].id })
          .returning({ id: UserSessions.id });

        const accessToken = await createAccessToken(session.id);
        context.event.cookies.set('penxle-at', accessToken, {
          path: '/',
          maxAge: dayjs.duration(1, 'year').asSeconds(),
        });

        return status(303, { headers: { Location: '/' } });
      } else {
        const token = nanoid();

        await tx.insert(ProvisionedUsers).values({
          email: userEmailVerification.email.toLowerCase(),
          token,
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
    } else if (userEmailVerification.kind === 'USER_EMAIL_UPDATE' && userEmailVerification.userId) {
      const users = await tx
        .select({ id: Users.id, email: Users.email, profile: { name: Profiles.name } })
        .from(Users)
        .innerJoin(Profiles, eq(Profiles.id, Users.profileId))
        .where(eq(Users.id, userEmailVerification.userId));
      if (users.length === 0) {
        throw new Error('user not found');
      }

      const [user] = users;

      const emailUsages = await tx
        .select({ id: Users.id })
        .from(Users)
        .where(and(eq(Users.email, userEmailVerification.email.toLowerCase()), eq(Users.state, 'ACTIVE')));

      if (emailUsages.length > 0) {
        throw new Error('email is already used');
      }

      await tx.update(Users).set({ email: userEmailVerification.email }).where(eq(Users.id, user.id));

      await sendEmail({
        subject: 'PENXLE 이메일이 변경되었어요.',
        recipient: user.email,
        template: UserEmailUpdated,
        props: {
          name: user.profile.name,
          email: userEmailVerification.email,
        },
      });

      return status(303, { headers: { Location: '/me/settings' } });
    }
  });
});
