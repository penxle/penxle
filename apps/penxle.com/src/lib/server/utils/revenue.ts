import dayjs from 'dayjs';
import { and, eq, inArray, isNull, lt, ne, sum } from 'drizzle-orm';
import { match } from 'ts-pattern';
import { RevenueWithdrawalKind } from '$lib/enums';
import { IntentionalError } from '$lib/errors';
import * as coocon from '$lib/server/external-api/coocon';
import { logToSlack } from '$lib/server/utils';
import { calculateFeeAmount, getMonthlyWithdrawableDayjsBefore } from '$lib/utils';
import { database, Revenues, RevenueWithdrawals, UserSettlementIdentities } from '../database';

const getWithdrawableDayjs = () => dayjs().subtract(7, 'day');

type GetUserRevenueParams = {
  userId: string;
  withdrawableOnly?: boolean;
  monthlyWithdrawableOnly?: boolean;
};
export const getUserRevenue = async ({ userId, withdrawableOnly, monthlyWithdrawableOnly }: GetUserRevenueParams) => {
  const [{ value }] = await database
    .select({ value: sum(Revenues.amount).mapWith(Number) })
    .from(Revenues)
    .where(
      and(
        eq(Revenues.userId, userId),
        ne(Revenues.state, 'PAID'),
        monthlyWithdrawableOnly
          ? lt(Revenues.createdAt, getMonthlyWithdrawableDayjsBefore())
          : withdrawableOnly
            ? lt(Revenues.createdAt, getWithdrawableDayjs())
            : undefined,
      ),
    );

  return value;
};

type SettleRevenueParams = {
  userId: string;
  settlementType: keyof typeof RevenueWithdrawalKind;
};
export const settleRevenue = async ({ userId, settlementType }: SettleRevenueParams) => {
  const settlementIdentities = await database
    .select({
      bankCode: UserSettlementIdentities.bankCode,
      bankAccountNumber: UserSettlementIdentities.bankAccountNumber,
    })
    .from(UserSettlementIdentities)
    .where(eq(UserSettlementIdentities.userId, userId));

  if (settlementIdentities.length === 0) {
    throw new IntentionalError('먼저 계좌 인증을 진행해 주세요');
  }

  const withdrawal = await database.transaction(async (tx) => {
    const revenues = await tx
      .select({ id: Revenues.id, amount: Revenues.amount })
      .from(Revenues)
      .where(
        and(
          eq(Revenues.userId, userId),
          ne(Revenues.state, 'PAID'),
          isNull(Revenues.withdrawalId),
          lt(Revenues.createdAt, getWithdrawableDayjs()),
        ),
      )
      .for('update');

    const totalRevenueAmount = revenues.reduce((sum, revenue) => sum + revenue.amount, 0);

    if (
      !match(settlementType)
        .with('MONTHLY', () => totalRevenueAmount >= 30_000)
        .with('INSTANT', () => totalRevenueAmount >= 1000)
        .exhaustive()
    ) {
      throw new IntentionalError('출금할 수 있는 금액이 없어요');
    }

    const withdrawalFeeAmount = match(settlementType)
      .with('MONTHLY', () => 0)
      .with('INSTANT', () => 500)
      .exhaustive();

    const { settleAmount, taxBaseAmount, taxAmount, serviceFeeAmount } = calculateFeeAmount(
      totalRevenueAmount,
      withdrawalFeeAmount,
    );

    if (settleAmount <= 0) {
      throw new IntentionalError('출금할 수 있는 금액이 없어요');
    }

    if (
      settleAmount + serviceFeeAmount + taxAmount + withdrawalFeeAmount !== totalRevenueAmount ||
      Math.floor(taxBaseAmount * 0.033) !== taxAmount
    ) {
      throw new IntentionalError('출금 금액 계산에 문제가 발생했어요. 고객센터에 문의해주세요');
    }

    const [withdrawal] = await database
      .insert(RevenueWithdrawals)
      .values({
        userId,
        kind: settlementType,
        bankCode: settlementIdentities[0].bankCode,
        bankAccountNumber: settlementIdentities[0].bankAccountNumber,
        revenueAmount: totalRevenueAmount,
        paidAmount: settleAmount,
        taxAmount,
        serviceFeeAmount,
        withdrawalFeeAmount,
        totalFeeAmount: serviceFeeAmount + withdrawalFeeAmount,
        taxBaseAmount,
      })
      .returning({
        id: RevenueWithdrawals.id,
        bankCode: RevenueWithdrawals.bankCode,
        bankAccountNumber: RevenueWithdrawals.bankAccountNumber,
        paidAmount: RevenueWithdrawals.paidAmount,
      });

    await tx
      .update(Revenues)
      .set({ withdrawalId: withdrawal.id })
      .where(
        inArray(
          Revenues.id,
          revenues.map((revenue) => revenue.id),
        ),
      );

    return withdrawal;
  });

  let txId: string | undefined;

  try {
    txId = await coocon.transferOut({
      bankCode: withdrawal.bankCode,
      accountNumber: withdrawal.bankAccountNumber,
      amount: withdrawal.paidAmount,
      memo: withdrawal.id,
    });
  } catch (err) {
    logToSlack('settle', {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '수익출금 실패',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `UserID: ${userId}\nSettlementID: ${withdrawal.id}\nError: ${(err as Error).message}`,
          },
        },
      ],
    });

    await database.transaction(async (tx) => {
      await tx.update(RevenueWithdrawals).set({ state: 'FAILED' }).where(eq(RevenueWithdrawals.id, withdrawal.id));
      await tx.update(Revenues).set({ withdrawalId: null }).where(eq(Revenues.withdrawalId, withdrawal.id));
    });

    throw new IntentionalError('수익출금에 실패했어요');
  }

  try {
    await database.transaction(async (tx) => {
      const revenues = await tx
        .select({ id: Revenues.id })
        .from(Revenues)
        .where(eq(Revenues.withdrawalId, withdrawal.id))
        .for('update');

      const withdrawals = await tx
        .select({ id: RevenueWithdrawals.id })
        .from(RevenueWithdrawals)
        .where(eq(RevenueWithdrawals.id, withdrawal.id))
        .for('update');

      if (revenues.length === 0 || withdrawals.length === 0) {
        throw new IntentionalError('수익출금 정보가 없어요. 고객센터에 문의해 주세요');
      }

      const txSuccess = await coocon.verifyTransferOut({ txId });
      if (!txSuccess) {
        throw new IntentionalError('이체 검증에 실패했어요. 고객센터에 문의해 주세요');
      }

      await tx
        .update(RevenueWithdrawals)
        .set({ txId, state: 'SUCCESS' })
        .where(eq(RevenueWithdrawals.id, withdrawals[0].id));

      await tx
        .update(Revenues)
        .set({ state: 'PAID' })
        .where(
          inArray(
            Revenues.id,
            revenues.map((revenue) => revenue.id),
          ),
        );
    });
  } catch (err) {
    logToSlack('settle', {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '수익출금 이후 동작 실패!!',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `UserID: ${userId}\nSettlementID: ${withdrawal.id}\nTxID: ${txId}\nAmount: ${withdrawal.paidAmount}\nError: ${(err as Error).message}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `이체가 이미 진행되었기 때문에 수동으로 처리해 주세요!!`,
          },
        },
      ],
    });

    throw err;
  }

  logToSlack('settle', {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '수익 출금 알림',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `UserID: ${userId}\nSettlementID: ${withdrawal.id}\nTxID: ${txId}\nAccount:${withdrawal.bankCode} ${withdrawal.bankAccountNumber}\nAmount: ${withdrawal.paidAmount}`,
        },
      },
    ],
  });

  return withdrawal;
};
