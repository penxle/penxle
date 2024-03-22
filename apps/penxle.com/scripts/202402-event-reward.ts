import dayjs from 'dayjs';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { database, PointBalances, PointTransactions, UserEventEnrollments } from '$lib/server/database';

let eventEnrollmentCount = 0;
do {
  await database.transaction(async (tx) => {
    const eventEnrollments = await tx
      .select({ id: UserEventEnrollments.id, userId: UserEventEnrollments.userId })
      .from(UserEventEnrollments)
      .where(
        and(
          inArray(UserEventEnrollments.eventCode, ['post_publish_202402', 'twitter_spacelink_2024']),
          eq(UserEventEnrollments.eligible, true),
          isNull(UserEventEnrollments.rewardedAt),
        ),
      )
      .limit(100)
      .for('update');

    eventEnrollmentCount = eventEnrollments.length;
    if (eventEnrollmentCount === 0) {
      return;
    }

    await tx
      .update(UserEventEnrollments)
      .set({ rewardedAt: dayjs() })
      .where(
        inArray(
          UserEventEnrollments.id,
          eventEnrollments.map((enrollment) => enrollment.id),
        ),
      );

    await tx.insert(PointBalances).values(
      eventEnrollments.map((enrollment) => ({
        userId: enrollment.userId,
        kind: 'FREE' as const,
        initial: 2000,
        leftover: 2000,
        expiresAt: dayjs().add(1, 'years'),
      })),
    );

    await tx.insert(PointTransactions).values(
      eventEnrollments.map((enrollment) => ({
        userId: enrollment.userId,
        amount: 2000,
        cause: 'EVENT_REWARD' as const,
        targetId: enrollment.id,
      })),
    );
  });
} while (eventEnrollmentCount > 0);
