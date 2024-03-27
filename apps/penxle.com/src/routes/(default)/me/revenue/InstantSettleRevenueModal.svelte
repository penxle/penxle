<script lang="ts">
  import IconInfoCircle from '~icons/tabler/alert-circle';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Icon, Tooltip } from '$lib/components';
  import { Button, Modal } from '$lib/components/v2';
  import { banks } from '$lib/const/revenue';
  import { comma } from '$lib/utils';
  import { calculateFeeAmount } from '$lib/utils/revenue';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { MeRevenuePage_InstantSettleRevenueModal_user } from '$glitch';

  export let open = false;

  let _user: MeRevenuePage_InstantSettleRevenueModal_user;
  export { _user as $user };

  $: user = fragment(
    _user,
    graphql(`
      fragment MeRevenuePage_InstantSettleRevenueModal_user on User {
        id
        withdrawableRevenue: revenue(withdrawable: true)

        settlementIdentity {
          id
          bankAccountHolderName
          bankCode
          bankAccountNumber
        }
      }
    `),
  );

  const instantSettleRevenue = graphql(`
    mutation InstantSettleRevenue_Mutation {
      instantSettleRevenue {
        id
        revenue(withdrawable: true)

        revenueWithdrawals {
          id
        }
      }
    }
  `);

  $: feeAmount = calculateFeeAmount($user.withdrawableRevenue, 500);
</script>

<Modal bind:open>
  <svelte:fragment slot="title">즉시출금</svelte:fragment>

  <p>
    창작자님의 출금 요청하신 금액은
    <br />
    <mark class={css({ fontSize: '20px', fontWeight: 'bold', color: 'teal.500' })}>
      {comma($user.withdrawableRevenue)}원
    </mark>
    입니다
  </p>

  <div
    class={flex({
      align: 'center',
      gap: '2px',
      marginY: '12px',
      paddingX: '10px',
      paddingY: '8px',
      borderRadius: '6px',
      fontSize: '13px',
      color: 'gray.500',
      backgroundColor: 'gray.50',
    })}
  >
    <span>{banks[$user.settlementIdentity?.bankCode ?? '']} {$user.settlementIdentity?.bankAccountNumber}</span>
    <span>({$user.settlementIdentity?.bankAccountHolderName})</span>
  </div>

  <dl class={css({ fontSize: '14px' })}>
    <div
      class={flex({
        align: 'center',
        gap: '16px',
        borderBottomWidth: '1px',
        borderColor: 'gray.100',
        paddingX: '10px',
        paddingY: '14px',
      })}
    >
      <dt class={css({ width: '120px' })}>총 출금 금액</dt>
      <dd class={css({ fontWeight: 'semibold' })}>{comma($user.withdrawableRevenue)}원</dd>
    </div>
    <div
      class={flex({
        align: 'center',
        gap: '16px',
        borderBottomWidth: '1px',
        borderColor: 'gray.100',
        paddingX: '10px',
        paddingY: '14px',
      })}
    >
      <dt class={css({ width: '120px' })}>서비스 이용료</dt>
      <dd class={css({ fontWeight: 'semibold' })}>{comma(feeAmount.serviceFeeAmount)}원</dd>
    </div>
    <div
      class={flex({
        align: 'center',
        gap: '16px',
        borderBottomWidth: '1px',
        borderColor: 'gray.100',
        paddingX: '10px',
        paddingY: '14px',
      })}
    >
      <dt class={flex({ align: 'center', gap: '2px', width: '120px' })}>
        즉시출금 수수료
        <Tooltip message="즉시출금 신청 시 1건당 500원의 추가 수수료가 발생해요">
          <Icon style={css.raw({ color: 'gray.500', transform: 'rotate(180deg)' })} icon={IconInfoCircle} />
        </Tooltip>
      </dt>
      <dd class={css({ fontWeight: 'semibold' })}>500원</dd>
    </div>
    <div
      class={flex({
        align: 'center',
        gap: '16px',
        borderBottomWidth: '1px',
        borderColor: 'gray.100',
        paddingX: '10px',
        paddingY: '14px',
      })}
    >
      <dt class={flex({ align: 'center', gap: '2px', width: '120px' })}>
        소득세
        <Tooltip
          style={flex.raw({ align: 'center' })}
          message="소득에 대한 세금을 직접 납부하는 불편함을 줄여드리기 위해 회사가 원천징수를 통해 대리해 납부해 드리는 금액이에요"
        >
          <Icon style={css.raw({ color: 'gray.500', transform: 'rotate(180deg)' })} icon={IconInfoCircle} />
        </Tooltip>
      </dt>
      <dd class={css({ fontWeight: 'semibold' })}>{comma(feeAmount.taxAmount)}원</dd>
    </div>
    <div
      class={flex({
        align: 'center',
        gap: '16px',
        borderBottomWidth: '1px',
        borderColor: 'gray.100',
        paddingX: '10px',
        paddingY: '14px',
      })}
    >
      <dt class={css({ width: '120px' })}>최종 지급 금액</dt>
      <dd class={css({ fontWeight: 'semibold' })}>{comma(feeAmount.settleAmount)}원</dd>
    </div>
  </dl>

  <p class={css({ paddingY: '10px', fontSize: '12px', color: 'gray.500' })}>
    - 즉시출금 신청 시 서비스 이용료와는 별개로 즉시출금 수수료가 추가로 발생합니다.
    <br />
    - 즉시출금은 신청 즉시 출금이 진행되며, 신청 이후 취소할 수 없습니다.
  </p>

  <Button
    slot="action"
    style={css.raw({ width: 'full' })}
    on:click={async () => {
      await instantSettleRevenue();
      mixpanel.track('user:instant-settle-revenue');
      open = false;
    }}
  >
    신청
  </Button>
</Modal>
