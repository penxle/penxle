import dayjs from 'dayjs';
import { and, eq } from 'drizzle-orm';
import { RevenueKind, RevenueState, RevenueWithdrawalKind, RevenueWithdrawalState } from '$lib/enums';
import { IntentionalError, NotFoundError } from '$lib/errors';
import {
  database,
  PostPurchases,
  Revenues,
  RevenueWithdrawals,
  UserSettlementIdentities,
  UserWithdrawalConfigs,
} from '$lib/server/database';
import { settleRevenue } from '$lib/server/utils';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import { Post } from './post';
import { User, UserWithdrawalConfig } from './user';

/**
 * * Types
 */

export const Revenue = createObjectRef('Revenue', Revenues);
Revenue.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    amount: t.exposeInt('amount'),
    kind: t.expose('kind', { type: RevenueKind }),
    state: t.expose('state', { type: RevenueState }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),

    post: t.field({
      type: Post,
      nullable: true,
      resolve: async (revenue) => {
        if (!revenue.targetId) {
          return null;
        }

        const postPurchases = await database
          .select({ postId: PostPurchases.postId })
          .from(PostPurchases)
          .where(eq(PostPurchases.id, revenue.targetId));

        if (postPurchases.length === 0) {
          return null;
        }

        return postPurchases[0].postId;
      },
    }),
  }),
});

export const RevenueWithdrawal = createObjectRef('RevenueWithdrawal', RevenueWithdrawals);
RevenueWithdrawal.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.expose('kind', { type: RevenueWithdrawalKind }),
    state: t.expose('state', { type: RevenueWithdrawalState }),
    bankCode: t.exposeString('bankCode'),
    bankAccountNumber: t.exposeString('bankAccountNumber'),
    revenueAmount: t.exposeInt('revenueAmount'),
    paidAmount: t.exposeInt('paidAmount'),
    taxAmount: t.exposeInt('taxAmount'),
    taxBaseAmount: t.exposeInt('taxBaseAmount'),
    serviceFeeAmount: t.exposeInt('serviceFeeAmount'),
    withdrawalFeeAmount: t.exposeInt('withdrawalFeeAmount'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  revenueWithdrawal: t.withAuth({ user: true }).field({
    type: RevenueWithdrawal,
    args: { id: t.arg.string() },
    resolve: async (_, args, context) => {
      const revenueWithdrawals = await database
        .select({ id: RevenueWithdrawals.id })
        .from(RevenueWithdrawals)
        .where(and(eq(RevenueWithdrawals.id, args.id), eq(RevenueWithdrawals.userId, context.session.userId)));

      if (revenueWithdrawals.length === 0) {
        throw new NotFoundError();
      }

      return revenueWithdrawals[0].id;
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  instantSettleRevenue: t.withAuth({ user: true }).field({
    type: User,
    resolve: async (_, __, context) => {
      await settleRevenue({ userId: context.session.userId, settlementType: 'INSTANT' });

      return context.session.userId;
    },
  }),

  enableMonthlyWithdrawal: t.withAuth({ user: true }).field({
    type: UserWithdrawalConfig,
    resolve: async (_, __, context) => {
      if (dayjs().kst().date() === 10) throw new IntentionalError('매월 10일에는 자동 출금 설정을 변경할 수 없어요');

      const userSettlementIdentities = await database
        .select({ id: UserSettlementIdentities.id })
        .from(UserSettlementIdentities)
        .where(eq(UserSettlementIdentities.userId, context.session.userId));

      if (userSettlementIdentities.length === 0) {
        throw new IntentionalError('먼저 계좌 인증을 진행해주세요');
      }

      const [userWithdrawalConfig] = await database
        .insert(UserWithdrawalConfigs)
        .values({
          userId: context.session.userId,
          monthlyWithdrawalEnabled: true,
        })
        .onConflictDoUpdate({
          target: UserWithdrawalConfigs.userId,
          set: { monthlyWithdrawalEnabled: true },
        })
        .returning({ id: UserWithdrawalConfigs.id });

      return userWithdrawalConfig.id;
    },
  }),

  disableMonthlyWithdrawal: t.withAuth({ user: true }).field({
    type: UserWithdrawalConfig,
    resolve: async (_, __, context) => {
      if (dayjs().kst().date() === 10) throw new IntentionalError('매월 10일에는 자동 출금 설정을 변경할 수 없어요');

      const userSettlementIdentities = await database
        .select({ id: UserSettlementIdentities.id })
        .from(UserSettlementIdentities)
        .where(eq(UserSettlementIdentities.userId, context.session.userId));

      if (userSettlementIdentities.length === 0) {
        throw new IntentionalError('먼저 계좌 인증을 진행해주세요');
      }

      const [userWithdrawalConfig] = await database
        .insert(UserWithdrawalConfigs)
        .values({
          userId: context.session.userId,
          monthlyWithdrawalEnabled: false,
        })
        .onConflictDoUpdate({
          target: UserWithdrawalConfigs.userId,
          set: { monthlyWithdrawalEnabled: false },
        })
        .returning({ id: UserWithdrawalConfigs.id });

      return userWithdrawalConfig.id;
    },
  }),
}));
