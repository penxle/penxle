<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import { graphql } from '$glitch';
  import { Button } from '$lib/components';
  import { toast } from '$lib/notification';
  import { comma } from '$lib/utils';

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

  const paymentMethods = {
    CREDIT_CARD: '신용카드',
    BANK_ACCOUNT: '계좌이체',
    VIRTUAL_BANK_ACCOUNT: '무통장 입금',
    GIFTCARD_CULTURELAND: '문화상품권',
    GIFTCARD_HAPPYMONEY: '해피머니',
    PHONE_BILL: '휴대폰결제',
    TOSS_PAY: '토스페이',
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

<div class="flex flex-col center w-full my-22">
  {#if $query.pointPurchase.state === 'PENDING' && $query.pointPurchase.paymentMethod === 'VIRTUAL_BANK_ACCOUNT'}
    <div class="w-full max-w-200">
      <h1 class="title-20-b w-full">포인트 충전을 위해 입금을 진행해주세요</h1>
      <p class="text-secondary mt-3">입금이 확인되면 페이지가 자동으로 넘어가요</p>

      <div class="space-y-3 my-6">
        <div class="bg-white border border-secondary rounded-2xl p-4">
          <p class="text-secondary mb-2">충전 상품</p>
          <div class=" w-full flex items-center p-4 rounded-lg hover:bg-primary bg-primary">
            <input name={`${$query.pointPurchase.pointAmount}`} class="mr-6 square-4" checked type="radio" />
            <label class="grow body-16-b" for={`${$query.pointPurchase.pointAmount}`}>
              {comma($query.pointPurchase.pointAmount)}P
            </label>
            <div>{comma($query.pointPurchase.paymentAmount)}원</div>
          </div>
        </div>

        <div class="bg-white border border-secondary rounded-2xl p-4 space-y-4">
          <div>
            <span class="inline-block text-secondary mr-4 w-15">입금 은행</span>
            <span>{$query.pointPurchase.paymentResult.vbank_name}</span>
          </div>

          <div class="flex items-center">
            <span class="inline-block text-secondary mr-4 w-15">입금 계좌</span>
            <span class="mr-4">{$query.pointPurchase.paymentResult.vbank_num}</span>
            <Button
              color="tertiary"
              size="sm"
              variant="outlined"
              on:click={() => {
                navigator.clipboard.writeText($query.pointPurchase.paymentResult.vbank_num);
                toast.success('계좌번호가 복사되었어요');
              }}
            >
              <i class="i-lc-copy square-4 text-secondary mr-1" />
              복사
            </Button>
          </div>

          <div>
            <span class="inline-block text-secondary mr-4 w-15">입금 금액</span>
            <span>{comma($query.pointPurchase.paymentAmount)}원</span>
          </div>
        </div>
      </div>

      <p class="text-center text-secondary body-14-m">
        {dayjs($query.pointPurchase.expiresAt).formatAsDateTime()} 까지 입금해주세요
      </p>
    </div>
  {:else}
    <div class="w-full max-w-200">
      <p class="text-center mb-6">
        <i class="i-lc-check-circle-2 square-13.75 text-green-50" />
      </p>
      <div class="space-y-3">
        <h1 class="text-center title-20-b">포인트가 충전 완료 되었어요!</h1>
        <p class="text-center text-secondary">펜슬의 다양한 작품을 감상해보세요</p>

        <div class="bg-white border border-secondary rounded-2xl p-4 space-y-4">
          <div>
            <span class="text-secondary mr-4">충전 금액</span>
            <span>{comma($query.pointPurchase.pointAmount)}P</span>
          </div>

          <div>
            <span class="text-secondary mr-4">충전 수단</span>
            <span>{paymentMethods[$query.pointPurchase.paymentMethod]}</span>
          </div>
        </div>

        <p class="text-center text-secondary bodylong-16-m">
          보유중인 포인트 : {comma($query.me.point)}P
        </p>
      </div>

      <div class="flex center mt-6">
        <Button class="max-w-48" href="/point" size="xl" type="link">포인트 내역 확인하러가기</Button>
      </div>
    </div>
  {/if}
</div>