import dayjs from 'dayjs';
import { error, status } from 'itty-router';
import { google } from '$lib/server/external-api';
import {
  createAccessToken,
  createRandomAvatar,
  directUploadImage,
  renderAvatar,
} from '$lib/server/utils';
import { createId } from '$lib/utils';
import { createRouter } from '../router';

export const sso = createRouter();

sso.get('/sso/google', async (_, { db, ...context }) => {
  const code = context.url.searchParams.get('code');
  const state = context.url.searchParams.get('state');
  if (!code || !state) {
    return error(400);
  }

  const payload = JSON.parse(state);
  const googleUser = await google.authorizeUser(context, code);

  const sso = await db.userSSO.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'GOOGLE',
        providerUserId: googleUser.id,
      },
    },
  });

  // 하나의 핸들러로 여러가지 기능을 처리하기에 케이스 분리가 필요함.

  if (payload.type === 'LINK') {
    // 케이스 1: 계정 연동중인 경우

    if (!context.session) {
      // 케이스 1 (fail): 현재 사이트에 로그인이 되어 있지 않은 상태
      // -> 에러

      return error(400);
    }

    if (sso) {
      // 케이스 1-1: 콜백이 날아온 구글 계정이 이미 사이트의 "누군가에게" 연동이 되어 있는 경우

      // eslint-disable-next-line unicorn/prefer-ternary
      if (sso.userId === context.session.userId) {
        // 케이스 1-1-1: 그 "누군가"가 현재 로그인된 본인인 경우
        // -> 이미 로그인도 되어 있고 연동도 되어 있으니 아무것도 하지 않음

        return status(301, { headers: { Location: '/me/account' } });
      } else {
        // 케이스 1-1-2: 그 "누군가"가 현재 로그인된 본인이 아닌 경우
        // -> 현재 로그인된 세션과 연동된 계정이 다르므로 에러

        return error(400);
      }
    } else {
      // 케이스 1-2: 콜백이 날아온 구글 계정이 아직 사이트에 연동이 안 된 계정인 경우

      const isEmailUsedByOtherUser = await db.user.exists({
        where: {
          id: { not: context.session.userId },
          email: googleUser.email,
        },
      });

      if (isEmailUsedByOtherUser) {
        // 케이스 1-2-1: 콜백이 날아온 구글 계정의 이메일과 같은 이메일의 계정이 이미 사이트에 있고, 그 계정이 현재 로그인된 계정이 아닐 경우
        // -> 딴 사람이거나 연동 실수를 하고 있는 가능성도 있으니 에러

        return error(400);
      } else {
        // 케이스 1-2-2: 콜백이 날아온 구글 계정의 이메일과 같은 이메일의 계정이 없거나, 있더라도 현재 로그인된 계정인 경우
        // -> 현재 로그인한 계정에 콜백이 날아온 구글 계정을 연동함

        await db.userSSO.create({
          data: {
            id: createId(),
            provider: 'GOOGLE',
            providerEmail: googleUser.email,
            providerUserId: googleUser.id,
            user: { connect: { id: context.session.userId } },
          },
        });

        return status(301, { headers: { Location: '/me/account' } });
      }
    }
  } else if (payload.type === 'AUTH') {
    // 케이스 2: 계정 로그인 혹은 가입중인 경우

    if (sso) {
      // 케이스 2-1: 콜백이 날아온 구글 계정이 이미 사이트의 "누군가에게" 연동이 되어 있는 경우
      // -> 그 "누군가"로 로그인함

      const session = await db.session.create({
        select: { id: true },
        data: { id: createId(), userId: sso.userId },
      });

      const accessToken = await createAccessToken(session.id);
      context.cookies.set('penxle-at', accessToken, {
        path: '/',
        maxAge: dayjs.duration(1, 'year').asSeconds(),
      });

      return status(301, { headers: { Location: '/' } });
    } else {
      // 케이스 2-2: 콜백이 날아온 구글 계정이 아직 사이트에 연동이 안 된 계정인 경우

      const isEmailExists = await db.user.exists({
        where: {
          email: googleUser.email,
        },
      });

      if (isEmailExists) {
        // 케이스 2-2-1: 콜백이 날아온 구글 계정의 이메일과 같은 이메일의 계정이 이미 사이트에 있으나, 연동이 안 된 경우
        // -> "아직 연동이 안 되었으니" 로그인해주면 안 됨. 다시 로그인 페이지로 리다이렉트.

        // TODO: querystring 같은거 넣어서 로그인 페이지에서 연동 안 된 계정이라고 비밀번호 로그인하라고 알려줘야 할 듯.
        return status(301, { headers: { Location: '/login' } });
      } else {
        // 케이스 2-2-2: 콜백이 날아온 구글 계정의 이메일이 연동되지 않았고, 같은 이메일의 계정도 사이트에 없는 경우
        // -> 새로 가입함

        const avatarBuffer =
          (await fetch(googleUser.avatarUrl)
            .then((res) => res.arrayBuffer())
            .then((profileArrayBuffer) => Buffer.from(profileArrayBuffer))
            .catch(() => null)) ?? (await renderAvatar(createRandomAvatar())); // 구글 프로필 사진을 가져오는 데 실패한 경우 (없다던가)

        const avatarId = await directUploadImage({
          db,
          name: 'google-avatar.jpg',
          buffer: avatarBuffer,
        });

        const user = await db.user.create({
          data: {
            id: createId(),
            email: googleUser.email,
            state: 'ACTIVE',
            profile: {
              create: {
                id: createId(),
                name: googleUser.name,
                avatarId,
              },
            },
            ssos: {
              create: {
                id: createId(),
                provider: 'GOOGLE',
                providerEmail: googleUser.email,
                providerUserId: googleUser.id,
              },
            },
          },
        });

        await db.image.update({
          where: { id: avatarId },
          data: { userId: user.id },
        });

        const session = await db.session.create({
          select: { id: true },
          data: { id: createId(), userId: user.id },
        });

        const accessToken = await createAccessToken(session.id);
        context.cookies.set('penxle-at', accessToken, {
          path: '/',
          maxAge: dayjs.duration(1, 'year').asSeconds(),
        });

        return status(301, { headers: { Location: '/' } });
      }
    }
  }

  // 여기까지 오면 안 됨
});