<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import IconCircleCheck from '~icons/tabler/circle-check';
  import IconCopy from '~icons/tabler/copy';
  import { graphql } from '$glitch';
  import { Button, Helmet, Icon } from '$lib/components';
  import { Radio } from '$lib/components/forms';
  import { comma } from '$lib/utils';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import type { PaymentMethod } from '$glitch';

  $: query = graphql(`
    query PointPurchaseCompletePage_Query($paymentKey: String!) {
      me @_required {
        id
        point
      }

      pointPurchase(paymentKey: $paymentKey) {
        id
        state
        pointAmount
        paymentMethod
        paymentAmount
        paymentResult
        expiresAt
      }
    }
  `);

  let timer: NodeJS.Timeout | null = null;

  const paymentMethods: Record<PaymentMethod, string> = {
    CREDIT_CARD: '신용카드',
    BANK_ACCOUNT: '계좌이체',
    VIRTUAL_BANK_ACCOUNT: '무통장 입금',
    PHONE_BILL: '휴대폰결제',
    GIFTCARD_CULTURELAND: '문화상품권',
    GIFTCARD_SMARTCULTURE: '스마트문화상품권',
    GIFTCARD_BOOKNLIFE: '도서문화상품권',
    PAYPAL: '페이팔',
  };

  onMount(() => {
    if ($query.pointPurchase.state === 'PENDING') {
      timer = setInterval(() => {
        query.refetch();
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  });

  $: if ($query.pointPurchase.state === 'COMPLETED' && timer) {
    clearInterval(timer);
  }
</script>

<Helmet description="펜슬 포인트를 충전할 수 있어요" title="포인트 충전" />

<div class={center({ flexDirection: 'column', marginY: '88px', width: 'full' })}>
  {#if $query.pointPurchase.state === 'PENDING' && $query.pointPurchase.paymentMethod === 'VIRTUAL_BANK_ACCOUNT'}
    <div class={css({ width: 'full', maxWidth: '800px' })}>
      <h1 class={css({ width: 'full', fontSize: '20px', fontWeight: 'bold' })}>
        포인트 충전을 위해 입금을 진행해주세요
      </h1>
      <p class={css({ marginTop: '12px', color: 'gray.500' })}>입금이 확인되면 페이지가 자동으로 넘어가요</p>

      <div class={css({ gap: '12px', marginY: '24px' })}>
        <div
          class={css({
            borderWidth: '1px',
            borderRadius: '16px',
            borderColor: 'gray.200',
            padding: '16px',
            backgroundColor: 'gray.5',
          })}
        >
          <p class={css({ marginBottom: '8px', color: 'gray.500' })}>충전 상품</p>
          <Radio
            class={css({
              gap: '24px',
              flexGrow: 1,
              borderTopWidth: '1px',
              borderRadius: '8px',
              padding: '16px',
              backgroundColor: 'gray.50',
              _firstOfType: { borderWidth: '0' },
            })}
            checked
          >
            <div class={flex({ alignItems: 'center', justify: 'space-between', width: 'full' })}>
              <p class={css({ fontSize: '16px', fontWeight: 'bold' })}>{comma($query.pointPurchase.pointAmount)}P</p>
              <p>{comma($query.pointPurchase.paymentAmount)}원</p>
            </div>
          </Radio>
        </div>

        <div
          class={css({
            gap: '16px',
            borderWidth: '1px',
            borderColor: 'gray.200',
            borderRadius: '16px',
            padding: '16px',
            backgroundColor: 'gray.5',
          })}
        >
          <div>
            <span class={css({ display: 'inline-block', color: 'gray.500', marginRight: '16px', width: '60px' })}>
              입금 은행
            </span>
            <span>{$query.pointPurchase.paymentResult.vbank_name}</span>
          </div>

          <div class={flex({ alignItems: 'center' })}>
            <span class={css({ display: 'inline-block', color: 'gray.500', marginRight: '16px', width: '60px' })}>
              입금 계좌
            </span>
            <span class={css({ marginRight: '16px' })}>{$query.pointPurchase.paymentResult.vbank_num}</span>
            <Button
              color="tertiary"
              size="sm"
              variant="outlined"
              on:click={() => {
                navigator.clipboard.writeText($query.pointPurchase.paymentResult.vbank_num);
              }}
            >
              <Icon style={css.raw({ marginRight: '4px', color: 'gray.500' })} icon={IconCopy} />
              복사
            </Button>
          </div>

          <div>
            <span class={css({ display: 'inline-block', color: 'gray.500', marginRight: '16px', width: '60px' })}>
              입금 금액
            </span>
            <span>{comma($query.pointPurchase.paymentAmount)}원</span>
          </div>
        </div>
      </div>

      <p class={css({ color: 'gray.500', fontSize: '14px', fontWeight: 'medium', textAlign: 'center' })}>
        {dayjs($query.pointPurchase.expiresAt).formatAsDateTime()} 까지 입금해주세요
      </p>
    </div>
  {:else}
    <div class={css({ width: 'full', maxWidth: '800px' })}>
      <p class={css({ marginBottom: '24px', textAlign: 'center' })}>
        <Icon style={css.raw({ size: '55px', color: '[#4ECEA6]' })} icon={IconCircleCheck} />
      </p>
      <div class={css({ gap: '12px' })}>
        <h1 class={css({ textAlign: 'center', fontSize: '20px', fontWeight: 'bold' })}>포인트가 충전 완료 되었어요!</h1>
        <p class={css({ textAlign: 'center', color: 'gray.500' })}>펜슬의 다양한 작품을 감상해보세요</p>

        <div
          class={css({
            backgroundColor: 'gray.5',
            borderWidth: '1px',
            borderColor: 'gray.200',
            borderRadius: '16px',
            padding: '16px',
            gap: '16px',
          })}
        >
          <div>
            <span class={css({ color: 'gray.500', marginRight: '16px' })}>충전 금액</span>
            <span>{comma($query.pointPurchase.pointAmount)}P</span>
          </div>

          <div>
            <span class={css({ color: 'gray.500', marginRight: '16px' })}>충전 수단</span>
            <span>{paymentMethods[$query.pointPurchase.paymentMethod]}</span>
          </div>
        </div>

        <p class={css({ color: 'gray.500', fontSize: '14px', fontWeight: 'medium', textAlign: 'center' })}>
          보유중인 포인트 : {comma($query.me.point)}P
        </p>
      </div>

      <div class={center({ marginTop: '24px' })}>
        <Button style={css.raw({ maxWidth: '192px' })} href="/point" size="xl" type="link">
          포인트 내역 확인하러가기
        </Button>
      </div>
    </div>
  {/if}
</div>
