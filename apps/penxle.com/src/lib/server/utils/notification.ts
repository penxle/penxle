import { and, eq, inArray } from 'drizzle-orm';
import * as R from 'radash';
import { UserNotificationCategory, UserNotificationMethod } from '$lib/enums';
import { database, UserNotificationPreferences, UserNotifications } from '../database';
import type { Notification } from '$lib/utils';

type CheckNotificationPreferencesParams = {
  userId: string;
  category: keyof typeof UserNotificationCategory;
};

type CheckNotificationPreferencesResult = Record<keyof typeof UserNotificationMethod, boolean>;

export const checkNotificationPreferences = async ({
  userId,
  category,
}: CheckNotificationPreferencesParams): Promise<CheckNotificationPreferencesResult> => {
  const preferences = await database
    .select({
      category: UserNotificationPreferences.category,
      method: UserNotificationPreferences.method,
      opted: UserNotificationPreferences.opted,
    })
    .from(UserNotificationPreferences)
    .where(
      and(
        eq(UserNotificationPreferences.userId, userId),
        inArray(UserNotificationPreferences.category, [category, 'ALL']),
      ),
    );

  return R.zipToObject(
    Object.values(UserNotificationMethod),
    (method: keyof typeof UserNotificationMethod) =>
      preferences.find((preference) => preference.method === method && preference.category === category)?.opted ??
      preferences.find((preference) => preference.method === method && preference.category === 'ALL')?.opted ??
      true,
  );
};

type CreateNotificationParams = Notification & {
  origin: string;
};

export const createNotification = async ({ userId, category, actorId, data }: CreateNotificationParams) => {
  const preferences = await checkNotificationPreferences({ userId, category });

  if (preferences.WEBSITE) {
    await database.insert(UserNotifications).values({
      userId,
      category,
      actorId,
      data,
      state: 'UNREAD',
    });
  }

  // 이메일 알림 일단 비활성화
  // if (preferences.EMAIL) {
  //   const user = await db.user.findUniqueOrThrow({
  //     where: { id: userId },
  //   });

  //   const actor = actorId
  //     ? await db.profile.findUniqueOrThrow({
  //         where: { id: actorId },
  //       })
  //     : null;

  //   switch (category) {
  //     case 'SUBSCRIBE': {
  //       const space = await db.space.findUniqueOrThrow({
  //         where: { id: data?.spaceId as string },
  //       });

  //       await sendEmail({
  //         subject: `[펜슬] ${actor?.name}님이 ${space.name} 스페이스를 관심 추가했어요`,
  //         recipient: user.email,
  //         template: Subscribe,
  //         props: {
  //           profileName: actor?.name as string,
  //           spaceName: space.name as string,
  //           spaceURL: `${origin}/${space.slug}`,
  //         },
  //       });
  //       break;
  //     }
  //     case 'PURCHASE': {
  //       const post = await db.post.findUniqueOrThrow({
  //         where: { id: data?.postId as string },
  //         include: { publishedRevision: true },
  //       });

  //       await sendEmail({
  //         subject: `[펜슬] ${actor?.name}님이 ${post.publishedRevision?.title} 포스트를 구매했어요`,
  //         recipient: user.email,
  //         template: Purchase,
  //         props: {
  //           profileName: actor?.name as string,
  //           postTitle: post.publishedRevision?.title as string,
  //           postURL: `https://pnxl.me/${BigInt(post.permalink).toString(36)}`,
  //         },
  //       });
  //     }
  //   }
  // }
};
