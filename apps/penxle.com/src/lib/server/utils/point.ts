import dayjs from 'dayjs';
import { and, asc, eq, gt, sum } from 'drizzle-orm';
import { database, PointBalances, PointTransactions } from '../database';
import type { PointKind, PointTransactionCause } from '$lib/enums';
import type { Transaction } from '../database';

type GetUserPointParams = {
  userId: string;
  kind?: keyof typeof PointKind;
};
export const getUserPoint = async ({ userId, kind }: GetUserPointParams) => {
  return await database
    .select({ sum: sum(PointBalances.leftover).mapWith(Number) })
    .from(PointBalances)
    .where(
      and(
        eq(PointBalances.userId, userId),
        gt(PointBalances.leftover, 0),
        gt(PointBalances.expiresAt, dayjs()),
        kind ? eq(PointBalances.kind, kind) : undefined,
      ),
    )
    .then(([{ sum }]) => sum ?? 0);
};

type DeductPointParams = {
  tx: Transaction;
  userId: string;
  amount: number;
  cause: keyof typeof PointTransactionCause;
  targetId?: string;
};
export const deductUserPoint = async ({ tx, userId, amount, targetId, cause }: DeductPointParams) => {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }

  const pointBalances = await tx
    .select({ id: PointBalances.id, leftover: PointBalances.leftover })
    .from(PointBalances)
    .where(and(eq(PointBalances.userId, userId), gt(PointBalances.leftover, 0), gt(PointBalances.expiresAt, dayjs())))
    .orderBy(asc(PointBalances.expiresAt), asc(PointBalances.kind))
    .for('update');

  let targetAmount = amount;
  const changes: { id: string; leftover: number }[] = [];

  for (const pointBalance of pointBalances) {
    if (targetAmount === 0) {
      break;
    }

    const leftover = Math.max(pointBalance.leftover - targetAmount, 0);
    targetAmount -= pointBalance.leftover - leftover;

    changes.push({
      id: pointBalance.id,
      leftover,
    });
  }

  if (targetAmount !== 0) {
    throw new Error('insufficient point');
  }

  for (const { id, leftover } of changes) {
    await tx.update(PointBalances).set({ leftover }).where(eq(PointBalances.id, id));
  }

  await tx.insert(PointTransactions).values({
    userId,
    cause,
    amount: -amount,
    targetId,
  });
};
