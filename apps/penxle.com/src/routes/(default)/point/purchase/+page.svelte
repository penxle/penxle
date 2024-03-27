<script lang="ts">
  import qs from 'query-string';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import Paypal from '$assets/icons/paypal.svg?component';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Helmet, Icon, Link, Modal } from '$lib/components';
  import { Checkbox, Radio } from '$lib/components/forms';
  import { createMutationForm } from '$lib/form';
  import { toast } from '$lib/notification';
  import { comma } from '$lib/utils';
  import { PurchasePointSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { center, flex, grid } from '$styled-system/patterns';
  import type { PaymentMethod } from '$glitch';

  $: query = graphql(`
    query PointPurchasePage_Query {
      auth(scope: USER)

      me @_required {
        id
        point
      }
    }
  `);

  const { form, data } = createMutationForm({
    mutation: graphql(`
      mutation PointPurchasePage_PurchasePoint_Mutation($input: PurchasePointInput!) {
        purchasePoint(input: $input) {
          id
          paymentData
        }
      }
    `),
    schema: PurchasePointSchema,
    onSuccess: (resp) => {
      mixpanel.track('point:purchase:start', {
        paymentMethod: $data.paymentMethod,
        pointAmount: $data.pointAmount,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callback = async (resp: any) => {
        if (resp.error_msg) {
          toast(resp.error_msg);
          return;
        }

        location.href = qs.stringifyUrl({
          url: '/api/payment/callback',
          query: { imp_uid: resp.imp_uid },
        });
      };

      // @ts-expect-error portone 관련 코드
      IMP.init('imp72534540');

      if (resp.paymentData.pg === 'paypal_v2') {
        paypalOpen = true;
        // @ts-expect-error portone 관련 코드
        IMP.loadUI('paypal-spb', resp.paymentData, callback);
      } else {
        // @ts-expect-error portone 관련 코드
        IMP.request_pay(resp.paymentData, callback);
      }
    },
  });

  let paypalOpen = false;

  const pointAmounts = [1000, 3000, 5000, 10_000, 30_000, 50_000, 100_000];
  const paymentMethods: [PaymentMethod, string][] = [
    ['CREDIT_CARD', '신용카드'],
    ['BANK_ACCOUNT', '계좌이체'],
    ['VIRTUAL_BANK_ACCOUNT', '가상계좌'],
    ['PHONE_BILL', '휴대폰결제'],
    ['GIFTCARD_CULTURELAND', '문화상품권'],
    ['GIFTCARD_SMARTCULTURE', '스마트문화상품권'],
    ['GIFTCARD_BOOKNLIFE', '도서문화상품권'],
    ['PAYPAL', '페이팔'],
  ];
</script>

<svelte:head>
  <script src="https://cdn.iamport.kr/v1/iamport.js">
  </script>
</svelte:head>

<Helmet description="펜슬 포인트를 충전할 수 있어요" title="포인트 충전" />

<form
  class={center({
    flexDirection: 'column',
    gap: '24px',
    marginY: '36px',
    paddingX: '16px',
    width: 'full',
    maxWidth: '800px',
    sm: { marginY: '88px' },
  })}
  use:form
>
  <h1 class={css({ width: 'full', fontSize: '20px', fontWeight: 'bold' })}>포인트 충전</h1>

  <p class={flex({ align: 'center', gap: '8px', width: 'full' })}>
    <span>보유중인 포인트 :</span>
    <span class={css({ fontSize: '20px', fontWeight: 'bold' })}>{comma($query.me.point)}P</span>
  </p>

  <div
    class={css({
      borderWidth: '1px',
      borderColor: 'gray.200',
      borderRadius: '16px',
      padding: '16px',
      width: 'full',
      backgroundColor: 'gray.5',
    })}
  >
    <div class={flex({ direction: 'column' })}>
      <div
        class={flex({
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderRadius: '8px',
          paddingX: '16px',
          paddingY: '8px',
          backgroundColor: 'gray.50',
          fontSize: '13px',
          fontWeight: 'medium',
          color: 'gray.500',
        })}
      >
        <div class={css({ marginRight: '16px' })}>선택</div>
        <div class={css({ flexGrow: 1 })}>충전 포인트</div>
        <div>금액</div>
      </div>
      {#each pointAmounts as amount (amount)}
        <Radio
          style={css.raw(
            {
              'padding': '16px',
              'borderTopWidth': '1px',
              '&:first-of-type': { borderWidth: '0' },
              '&:hover': { backgroundColor: 'gray.50' },
              'gap': '24px',
              'flexGrow': 1,
              'cursor': 'pointer',
            },
            $data.pointAmount === amount && { backgroundColor: 'gray.50' },
          )}
          checked={$data.pointAmount === amount}
          on:change={() => {
            $data.pointAmount = amount;
          }}
        >
          <div class={flex({ align: 'center', justify: 'space-between', width: 'full' })}>
            <p class={css({ fontSize: '16px', fontWeight: 'bold' })}>{comma(amount)}P</p>
            <p>{comma(amount)}원</p>
          </div>
        </Radio>
      {/each}
    </div>
  </div>

  <p class={css({ width: 'full' })}>결제수단</p>

  <div class={grid({ columns: 3, gap: '8px', sm: { gridTemplateColumns: '4', gap: '16px' }, width: 'full' })}>
    {#each paymentMethods as [method, name] (method)}
      <Button
        style={css.raw(
          { width: 'full', _disabled: { borderWidth: '1px' } },
          $data.paymentMethod === method && {
            backgroundColor: 'gray.100',
            borderWidth: '1px',
            borderColor: 'gray.900',
          },
        )}
        color="tertiary"
        size="xl"
        variant="outlined"
        on:click={() => ($data.paymentMethod = method)}
      >
        {#if method === 'PAYPAL'}
          <Paypal class={css({ height: '20px' })} />
        {:else}
          {name}
        {/if}
      </Button>
    {/each}
  </div>

  <div class={css({ borderRadius: '16px', padding: '16px', width: 'full', backgroundColor: 'gray.100' })}>
    <p class={flex({ align: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' })}>
      <Icon icon={IconAlertTriangle} />
      <span>결제 전 확인해주세요!</span>
    </p>
    <div class={css({ marginTop: '8px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
      <p>- 모든 금액은 부가가치세 제외 금액입니다. 결제 진행시 부가가치세 10%가 부과되어 결제됩니다.</p>
      <p>
        - 충전한 포인트 전액 결제 취소는 포인트를 구매한 뒤 사용한 이력이 없고 결제 후 7일 이내에 결제 취소한 경우에
        가능합니다.
      </p>
      <p>
        - 포인트는 결제한 날로부터 5년이 되는 시점에 소멸됩니다. 단, 직접 회원 탈퇴해서 계정이 삭제되면 그 즉시 소멸되어
        복구할 수 없습니다.
      </p>
      <p>
        - 잔여 포인트는 충전한 포인트의 잔액이 80% 이하일 때에 한해 환불 신청이 가능하며, 잔액의 10% 또는 1,000원 중 큰
        금액을 환급 수수료로 제외하고 환불해드립니다. 포인트 잔액이 1,000원 이하이면 환불이 불가능합니다. 환불은
        <Link style={css.raw({ textDecorationLine: 'underline' })} href="https://help.penxle.com/">
          펜슬 도움 센터
        </Link>를 통해 신청할 수 있습니다.
      </p>
      <p>- 무료로 지급받은 포인트는 환불받을 수 없으며, 지급일로부터 1년이 되는 시점에 소멸됩니다.</p>
      <p>
        - 환불 페이지의 모든 양식을 기입하여 제출하면 즉시 잔여 포인트가 차감됩니다. 환불한 금액은 영업일 기준으로 5일
        안에 환불 계좌로 입금해 드립니다.
      </p>
      <p>
        - 미성년자는 포인트를 충전하기 전에 부모 등 법정 대리인의 동의를 받아야 합니다. 법정대리인이 동의하지 않으면
        미성년자 본인 또는 법정대리인이 이용 계약을 취소할 수 있습니다.
      </p>
      <p>
        - 자세한 내용은 서비스 이용 전 동의하신
        <Link style={css.raw({ textDecorationLine: 'underline' })} href="https://help.penxle.com/legal/terms">
          이용약관
        </Link>을 참조해주시기 바랍니다.
      </p>
    </div>
  </div>

  <Checkbox name="pointAgreement" style={css.raw({ fontSize: '14px', fontWeight: 'medium' })}>
    주문 내용과 아래 유의 사항을 확인하였으며 결제 진행에 동의합니다.
  </Checkbox>

  <Button style={css.raw({ width: 'full', maxWidth: '500px' })} size="xl" type="submit">포인트 충전하기</Button>

  <p class={flex({ align: 'center', gap: '8px' })}>
    <span>충전 후 보유 포인트 :</span>
    <span class={css({ fontSize: '20px', fontWeight: 'bold' })}>
      {comma($query.me.point + ($data.pointAmount ?? 0))}P
    </span>
  </p>
</form>

<Modal bind:open={paypalOpen}>
  <div class="portone-ui-container" data-portone-ui-type="paypal-spb"></div>
</Modal>
