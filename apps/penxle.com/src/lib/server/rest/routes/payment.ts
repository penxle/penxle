import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import { status } from 'itty-router';
import qs from 'query-string';
import { database, PointBalances, PointPurchases, PointTransactions } from '$lib/server/database';
import { portone } from '$lib/server/external-api';
import { createRouter } from '../router';

export const payment = createRouter();

payment.get('/payment/callback', async (_, context) => {
  const uid = context.event.url.searchParams.get('imp_uid');
  if (!uid) {
    throw new Error('imp_uid is missing');
  }

  const resp = await portone.getPayment(uid);
  if (resp.code !== 0) {
    throw new Error(resp.message);
  }

  return await database.transaction(async (tx) => {
    const purchases = await tx
      .select({
        id: PointPurchases.id,
        state: PointPurchases.state,
        userId: PointPurchases.userId,
        paymentKey: PointPurchases.paymentKey,
        pointAmount: PointPurchases.pointAmount,
      })
      .from(PointPurchases)
      .where(eq(PointPurchases.paymentKey, resp.response.merchant_uid))
      .for('update');

    if (purchases.length === 0) {
      throw new Error('purchase not found');
    }

    const [purchase] = purchases;

    await tx.update(PointPurchases).set({ paymentResult: resp.response }).where(eq(PointPurchases.id, purchase.id));

    if (resp.response.status === 'paid' && purchase.state === 'PENDING') {
      await tx.insert(PointBalances).values({
        userId: purchase.userId,
        purchaseId: purchase.id,
        kind: 'PAID',
        initial: purchase.pointAmount,
        leftover: purchase.pointAmount,
        expiresAt: dayjs().add(5, 'years'),
      });

      await tx.insert(PointTransactions).values({
        userId: purchase.userId,
        amount: purchase.pointAmount,
        cause: 'PURCHASE',
        targetId: purchase.id,
      });

      await tx
        .update(PointPurchases)
        .set({ state: 'COMPLETED', completedAt: dayjs() })
        .where(eq(PointPurchases.id, purchase.id));
    } else if (resp.response.status === 'failed') {
      await tx.update(PointPurchases).set({ state: 'COMPLETED' }).where(eq(PointPurchases.id, purchase.id));

      await context.flash('error', resp.response.fail_reason);
      return status(303, { headers: { Location: '/point/purchase' } });
    }

    return status(303, {
      headers: {
        Location: qs.stringifyUrl({
          url: '/point/purchase/complete',
          query: { paymentKey: purchase.paymentKey },
        }),
      },
    });
  });
});

payment.post('/payment/webhook', async (_, context) => {
  const payload = await context.event.request.json();

  const resp = await portone.getPayment(payload.imp_uid);
  if (resp.code !== 0) {
    throw new Error(resp.message);
  }

  return await database.transaction(async (tx) => {
    const purchases = await tx
      .select({
        id: PointPurchases.id,
        state: PointPurchases.state,
        userId: PointPurchases.userId,
        paymentKey: PointPurchases.paymentKey,
        pointAmount: PointPurchases.pointAmount,
      })
      .from(PointPurchases)
      .where(eq(PointPurchases.paymentKey, resp.response.merchant_uid))
      .for('update');

    if (purchases.length === 0) {
      throw new Error('purchase not found');
    }

    const [purchase] = purchases;

    if (resp.response.status === 'paid' && purchase.state === 'PENDING') {
      await tx.insert(PointBalances).values({
        userId: purchase.userId,
        purchaseId: purchase.id,
        kind: 'PAID',
        initial: purchase.pointAmount,
        leftover: purchase.pointAmount,
        expiresAt: dayjs().add(5, 'years'),
      });

      await tx.insert(PointTransactions).values({
        userId: purchase.userId,
        amount: purchase.pointAmount,
        cause: 'PURCHASE',
        targetId: purchase.id,
      });

      await tx
        .update(PointPurchases)
        .set({ state: 'COMPLETED', completedAt: dayjs() })
        .where(eq(PointPurchases.id, purchase.id));
    }

    return status(200);
  });
});
