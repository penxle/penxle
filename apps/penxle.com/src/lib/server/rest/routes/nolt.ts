import { eq } from 'drizzle-orm';
import { status } from 'itty-router';
import { SignJWT } from 'jose';
import qs from 'query-string';
import { env } from '$env/dynamic/private';
import { database, Images, Profiles, Users } from '$lib/server/database';
import { createRouter } from '../router';

export const nolt = createRouter();

const key = new TextEncoder().encode(env.PRIVATE_NOLT_SSO_SECRET_KEY);

nolt.get('/nolt', async (_, context) => {
  if (!context.session) {
    return status(303, { headers: { Location: '/login' } });
  }

  const users = await database
    .select({ id: Users.id, email: Users.email, profile: { name: Profiles.name }, avatar: { path: Images.path } })
    .from(Users)
    .innerJoin(Profiles, eq(Profiles.id, Users.profileId))
    .innerJoin(Images, eq(Images.id, Profiles.avatarId))
    .where(eq(Users.id, context.session.userId));

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const [user] = users;

  const ssoToken = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.profile.name,
    imageUrl: `https://glyph.pub/${user.avatar.path}`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(key);

  return status(303, {
    headers: {
      Location: qs.stringifyUrl({
        url: `https://feedback.penxle.com/sso/${ssoToken}`,
        query: { returnUrl: context.event.url.searchParams.get('returnUrl') },
      }),
    },
  });
});
