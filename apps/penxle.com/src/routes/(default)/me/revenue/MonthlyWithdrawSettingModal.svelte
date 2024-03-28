<script lang="ts">
  import dayjs from 'dayjs';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Switch } from '$lib/components/forms';
  import { Modal } from '$lib/components/v2';
  import { banks } from '$lib/const/revenue';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { MeRevenuePage_MonthlyWithdrawSettingModal_user } from '$glitch';

  export let open = false;

  let _user: MeRevenuePage_MonthlyWithdrawSettingModal_user;
  export { _user as $user };

  $: user = fragment(
    _user,
    graphql(`
      fragment MeRevenuePage_MonthlyWithdrawSettingModal_user on User {
        id

        withdrawalConfig {
          id
          monthlyWithdrawalDue
          monthlyWithdrawalEnabled
        }

        settlementIdentity {
          id
          bankCode
          bankAccountNumber
          bankAccountHolderName
        }
      }
    `),
  );

  const disableMonthlyWithdrawal = graphql(`
    mutation MeRevenuePage_MonthlyWithdrawSettingModal_DisableMonthlyWithdrawal_Mutation {
      disableMonthlyWithdrawal {
        id
        monthlyWithdrawalDue
        monthlyWithdrawalEnabled
      }
    }
  `);

  const enableMonthlyWithdrawal = graphql(`
    mutation MeRevenuePage_MonthlyWithdrawSettingModal_EnableMonthlyWithdrawal_Mutation {
      enableMonthlyWithdrawal {
        id
        monthlyWithdrawalDue
        monthlyWithdrawalEnabled
      }
    }
  `);
</script>

<Modal style={css.raw({ paddingBottom: '0' })} bind:open>
  <svelte:fragment slot="title">자동 출금 설정</svelte:fragment>

  <div class={flex({ align: 'center', justify: 'space-between' })}>
    <div class={flex({ flexDirection: 'column', gap: '2px' })}>
      <p class={css({ fontWeight: 'semibold' })}>자동출금</p>
      {#if $user.withdrawalConfig?.monthlyWithdrawalDue}
        <span class={css({ fontSize: '10px', color: 'gray.400' })}>
          ({dayjs($user.withdrawalConfig.monthlyWithdrawalDue).formatAsDate()} 출금예정)
        </span>
      {/if}
    </div>
    <Switch
      checked={!!$user.withdrawalConfig?.monthlyWithdrawalEnabled}
      on:change={async () => {
        if ($user.withdrawalConfig?.monthlyWithdrawalEnabled) {
          await disableMonthlyWithdrawal();
          mixpanel.track('user:disable-monthly-withdrawal');
        } else {
          await enableMonthlyWithdrawal();
          mixpanel.track('user:enable-monthly-withdrawal');
        }
      }}
    />
  </div>

  <div
    class={flex({
      align: 'center',
      gap: '2px',
      marginTop: '12px',
      marginBottom: '20px',
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

  <div class={css({ marginX: '-20px', padding: '20px', paddingBottom: '60px', backgroundColor: 'gray.50' })}>
    <p class={css({ marginBottom: '8px', fontSize: '14px', fontWeight: 'semibold', color: 'gray.500' })}>유의사항</p>

    <p class={css({ fontSize: '13px', color: 'gray.500' })}>
      - 자동출금 기능 활성화 시 매달 10일에 이전달 말일까지 누적된 수익금 전체가 출금됩니다.
      <br />
      - 매달 1일 00시 기준으로 잔여 수익금이 30,000원 미만인 경우 해당 월은 자동출금이 진행되지 않습니다.
      <br />
      - 매달 10일에는 자동출금 설정 변경을 할 수 없습니다.
      <br />
      - 자동출금은 한국 시간(UTC+9) 기준으로 진행됩니다.
    </p>
  </div>
</Modal>
