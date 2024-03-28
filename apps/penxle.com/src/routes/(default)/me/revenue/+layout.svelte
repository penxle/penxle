<script lang="ts">
  import dayjs from 'dayjs';
  import IconInfoCircle from '~icons/tabler/alert-circle';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import { graphql } from '$glitch';
  import { Icon, Tooltip } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { Button } from '$lib/components/v2';
  import { banks } from '$lib/const/revenue';
  import { comma } from '$lib/utils';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import InstantSettleRevenueModal from './InstantSettleRevenueModal.svelte';
  import MonthlyWithdrawSettingModal from './MonthlyWithdrawSettingModal.svelte';
  import VerifySettlementIdentityModal from './VerifySettlementIdentityModal.svelte';

  let instantSettleRevenueOpen = false;
  let monthlyWithdrawSettingOpen = false;
  let open = false;

  $: query = graphql(`
    query MeRevenueLayout_Query {
      auth(scope: USER)

      me @_required {
        id
        revenue
        withdrawableRevenue: revenue(withdrawable: true)

        withdrawalConfig {
          id
          monthlyWithdrawalDue
          monthlyWithdrawalEnabled
        }

        personalIdentity {
          id
        }

        settlementIdentity {
          id
          bankCode
          bankAccountNumber
        }

        ...MeRevenuePage_InstantSettleRevenueModal_user
        ...MeRevenuePage_MonthlyWithdrawSettingModal_user
        ...MeRevenuePage_VerifySettlementIdentityModal_user
      }
    }
  `);
</script>

<h1
  class={css({
    paddingBottom: '8px',
    fontSize: '24px',
    fontWeight: 'bold',
    smDown: { paddingTop: '24px', paddingX: '20px' },
  })}
>
  수익/출금
</h1>

{#if $query.me.settlementIdentity}
  <p class={flex({ align: 'center', gap: '2px', smDown: { paddingX: '20px' } })}>
    내 계좌:
    <span>{banks[$query.me.settlementIdentity.bankCode]} {$query.me.settlementIdentity.bankAccountNumber}</span>
    <Tooltip style={flex.raw({ align: 'center' })} message="출금 계좌 변경은 사이트 하단 고객센터를 통해 가능해요">
      <Icon style={css.raw({ color: 'gray.500', transform: 'rotate(180deg)' })} icon={IconInfoCircle} />
    </Tooltip>
  </p>
{/if}

<div class={flex({ gap: '12px', marginTop: '20px', smDown: { paddingX: '20px' } })}>
  <div
    class={flex({
      flexDirection: 'column',
      justify: 'space-between',
      borderWidth: '1px',
      borderColor: 'gray.150',
      borderRadius: '8px',
      backgroundColor: 'gray.5',
      width: 'full',
      maxWidth: '278px',
      padding: { base: '20px', sm: '24px' },
    })}
  >
    <div>
      <div class={flex({ align: 'center', gap: '4px', fontSize: { base: '14px', sm: '16px' }, fontWeight: 'medium' })}>
        출금 가능 금액
        <Tooltip style={flex.raw({ align: 'center' })} message="수익 발생 후 7일이 지난 수익금을 출금할 수 있어요">
          <Icon style={css.raw({ color: 'gray.500', transform: 'rotate(180deg)' })} icon={IconInfoCircle} />
        </Tooltip>
      </div>
      <p class={css({ fontSize: { base: '24px', sm: '26px' }, fontWeight: 'semibold' })}>
        {comma($query.me.withdrawableRevenue)}원
      </p>
    </div>

    <Tooltip
      enabled={!!$query.me.settlementIdentity && $query.me.withdrawableRevenue < 1000}
      message="즉시출금은 1,000원 이상부터 신청 가능해요"
    >
      <Button
        style={css.raw({ width: 'full', hideFrom: 'sm' })}
        disabled={!!$query.me.settlementIdentity && $query.me.withdrawableRevenue < 1000}
        size="md"
        on:click={() => {
          if (!$query.me.settlementIdentity) {
            open = true;
            return;
          }

          instantSettleRevenueOpen = true;
        }}
      >
        즉시출금
      </Button>
      <Button
        style={css.raw({ width: 'full', hideBelow: 'sm' })}
        disabled={!!$query.me.settlementIdentity && $query.me.withdrawableRevenue < 1000}
        size="lg"
        on:click={() => {
          if (!$query.me.settlementIdentity) {
            open = true;
            return;
          }

          instantSettleRevenueOpen = true;
        }}
      >
        즉시출금
      </Button>
    </Tooltip>
  </div>
  <div class={flex({ flexDirection: 'column', gap: '8px', width: { base: 'full', sm: 'fit' } })}>
    <div
      class={css({
        borderWidth: '1px',
        borderColor: 'gray.150',
        borderRadius: '8px',
        padding: { base: '20px', sm: '24px' },
        backgroundColor: 'gray.5',
      })}
    >
      <div
        class={flex({
          sm: { gap: '4px' },
          flexWrap: 'wrap',
          align: { base: 'start', sm: 'center' },
          marginBottom: '2px',
          smDown: { flexDirection: 'column' },
        })}
      >
        <p class={css({ fontSize: { base: '14px', sm: '16px' }, fontWeight: 'medium' })}>포스트 수익</p>
        <time class={css({ fontSize: '11px', color: 'gray.400' })}>(-{dayjs(new Date()).formatAsDate()})</time>
      </div>
      <p class={css({ fontSize: { base: '16px', sm: '18px' }, fontWeight: { base: 'medium', sm: 'semibold' } })}>
        {comma($query.me.revenue)}P
      </p>
    </div>
    <button
      class={flex({
        flexDirection: 'column',
        gap: '4px',
        borderWidth: '1px',
        borderColor: 'gray.150',
        borderRadius: '8px',
        padding: { base: '20px', sm: '24px' },
        backgroundColor: 'gray.5',
      })}
      type="button"
      on:click={() => {
        if (!$query.me.settlementIdentity) {
          open = true;
          return;
        }

        monthlyWithdrawSettingOpen = true;
      }}
    >
      <div class={flex({ align: 'center', gap: '4px' })}>
        <p class={css({ fontSize: { base: '14px', sm: '16px' }, fontWeight: 'medium' })}>자동 출금</p>
        {#if $query.me.withdrawalConfig?.monthlyWithdrawalEnabled}
          {#if $query.me.withdrawalConfig.monthlyWithdrawalDue}
            <time class={css({ fontSize: '10px', color: 'gray.400' })}>
              ({dayjs($query.me.withdrawalConfig.monthlyWithdrawalDue).formatAsDate()} 출금예정)
            </time>
          {:else}
            <mark class={css({ fontSize: '10px', color: '[#FF8736]' })}>3만원 미달</mark>
          {/if}
        {/if}
      </div>

      <p
        class={css(
          { display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'semibold', width: 'full' },
          $query.me.withdrawalConfig?.monthlyWithdrawalEnabled ? { color: 'teal.500' } : { color: 'gray.500' },
          !$query.me.settlementIdentity && { fontSize: '14px', fontWeight: 'medium' },
        )}
      >
        {#if $query.me.settlementIdentity}
          {$query.me.withdrawalConfig?.monthlyWithdrawalEnabled ? 'ON' : 'OFF'}
        {:else}
          계좌 인증이 필요해요
        {/if}
        <Icon icon={IconChevronRight} size={20} />
      </p>
    </button>
  </div>
</div>

{#if !$query.me.personalIdentity || !$query.me.settlementIdentity}
  <div
    class={css({
      paddingX: { base: '20px', sm: '24px' },
      paddingY: '20px',
      marginTop: '12px',
      backgroundColor: 'gray.5',
      sm: {
        borderWidth: '1px',
        borderColor: 'gray.150',
        borderRadius: '8px',
      },
    })}
  >
    <p class={css({ fontWeight: 'semibold' })}>출금 전 계좌 인증이 필요해요</p>

    <p class={css({ marginTop: '4px', marginBottom: '16px', fontSize: '14px', color: 'gray.500' })}>
      수익금을 출금하기 전 계좌 인증이 필요해요. 본인 명의의 국내 은행 계좌와 신분증을 미리 준비해 주세요.
    </p>

    <button
      class={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        color: 'teal.500',
        width: 'fit',
        fontSize: '14px',
        fontWeight: 'medium',
      })}
      type="button"
      on:click={() => (open = true)}
    >
      계좌인증 <Icon icon={IconChevronRight} />
    </button>
  </div>
{/if}

<div
  class={css({
    marginTop: '10px',
    paddingX: { smDown: '20px' },
    fontSize: '13px',
    color: '[#9B9B9E]',
  })}
>
  - 즉시출금은 최소 1,000원부터 가능하며, 즉시출금 수수료가 별도로 발생합니다.
  <br />
  - 자동출금 진행일은 매월 10일이며, 잔여 수익금이 30,000원 이상일 경우 진행됩니다.
</div>

<div
  class={flex({
    direction: 'column',
    gap: '12px',
    marginTop: '40px',
    paddingTop: '20px',
    paddingBottom: '32px',
    backgroundColor: 'gray.5',
    sm: {
      borderWidth: '1px',
      borderColor: 'gray.200',
      borderRadius: '16px',
    },
  })}
>
  <TabHead>
    <TabHeadItem id={1} style={css.raw({ fontSize: '16px' })} pathname="/me/revenue">내 수익</TabHeadItem>
    <TabHeadItem id={2} style={css.raw({ fontSize: '16px' })} pathname="/me/revenue/settlement">출금 내역</TabHeadItem>
  </TabHead>

  <div class={css({ paddingX: { base: '20px', sm: '24px' } })}>
    <slot />
  </div>
</div>

<InstantSettleRevenueModal $user={$query.me} bind:open={instantSettleRevenueOpen} />
<MonthlyWithdrawSettingModal $user={$query.me} bind:open={monthlyWithdrawSettingOpen} />
<VerifySettlementIdentityModal $user={$query.me} bind:open />
