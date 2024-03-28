<script lang="ts">
  import dayjs from 'dayjs';
  import { nanoid } from 'nanoid';
  import qs from 'query-string';
  import { onMount } from 'svelte';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Avatar, Button, Chip, Helmet, Icon } from '$lib/components';
  import { Switch } from '$lib/components/forms';
  import { toast } from '$lib/notification';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import UpdateEmailModal from './UpdateEmailModal.svelte';
  import UpdateProfileModal from './UpdateProfileModal.svelte';
  import UserSingleSignOn from './UserSingleSignOn.svelte';
  import VerifyPassportIdentityModal from './VerifyPassportIdentityModal.svelte';

  let updateEmailOpen = false;
  let updateProfileOpen = false;
  let verifyPassportIdentityOpen = false;

  $: query = graphql(`
    query MeSettingsPage_Query {
      auth(scope: USER)

      me @_required {
        id
        email
        state

        marketingConsent {
          id
          createdAt
        }

        personalIdentity {
          id
          createdAt
        }

        profile {
          id
          name

          ...Avatar_profile
          ...MeSettingsPage_UpdateProfileModal_profile
        }

        ...MeSettingsPage_UserSingleSignOn_user
      }
    }
  `);

  const updateUserMarketingConsent = graphql(`
    mutation MeSettingsPage_UpdateUserMarketingConsent_Mutation($input: UpdateUserMarketingConsentInput!) {
      updateUserMarketingConsent(input: $input) {
        id

        marketingConsent {
          id
          createdAt
        }
      }
    }
  `);

  const handleUserIdentityVerification = () => {
    mixpanel.track('user:personal-identity-verification:start');

    // @ts-expect-error portone 관련 코드
    IMP.init('imp72534540');

    // @ts-expect-error portone 관련 코드
    IMP.certification(
      {
        merchant_uid: nanoid(),
        company: 'PENXLE',
        m_redirect_url: `${$page.url.origin}/api/identification/callback`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (resp: any) => {
        if (resp.error_msg) {
          toast(resp.error_msg);
          return;
        }

        location.href = qs.stringifyUrl({
          url: '/api/identification/callback',
          query: { imp_uid: resp.imp_uid },
        });
      },
    );
  };

  onMount(() => {
    switch ($page.url.searchParams.get('message')) {
      case 'sso_already_linked_by_other':
        toast('이 소셜 계정은 이미 다른 펜슬 계정에 연동되어 있어요.');
        break;
    }
  });
</script>

<svelte:head>
  <script src="https://cdn.iamport.kr/v1/iamport.js">
  </script>
</svelte:head>

<Helmet description="내 계정을 설정해요" title="계정 설정" />

<div
  class={flex({ flexDirection: 'column', gap: '32px', paddingY: '32px', paddingX: '24px', sm: { paddingX: '32px' } })}
>
  <div class={flex({ align: 'center', justify: 'space-between', flexWrap: 'wrap', gap: '16px' })}>
    <div class={flex({ align: 'center', gap: '12px' })}>
      <Avatar style={css.raw({ size: '50px' })} $profile={$query.me.profile} />
      <div class={flex({ flexDirection: 'column', flexWrap: 'wrap' })}>
        <span class={css({ marginRight: '8px', fontSize: '18px', fontWeight: 'bold' })}>
          {$query.me.profile.name}
        </span>
        <span class={css({ fontSize: '15px', color: 'gray.500' })}>{$query.me.email}</span>
      </div>
    </div>
    <Button color="secondary" size="md" on:click={() => (updateProfileOpen = true)}>프로필 수정</Button>
  </div>

  <div class={flex({ align: 'center', justify: 'space-between', flexWrap: 'wrap', gap: '16px' })}>
    <div>
      <div class={flex({ align: 'center', flexWrap: 'wrap', marginBottom: '8px' })}>
        <h3 class={css({ marginRight: '8px', fontSize: '18px', fontWeight: 'bold' })}>이메일 인증</h3>
        <Chip style={css.raw({ fontSize: '12px', fontWeight: 'bold' })} color="grass">인증 완료</Chip>
      </div>
    </div>

    <Button color="tertiary" size="md" variant="outlined" on:click={() => (updateEmailOpen = true)}>변경하기</Button>
  </div>

  <div class={flex({ align: 'center', justify: 'space-between', flexWrap: 'wrap', gap: '16px' })}>
    <div>
      <div class={flex({ align: 'center', flexWrap: 'wrap', marginBottom: '8px' })}>
        <h3 class={css({ marginRight: '8px', fontSize: '18px', fontWeight: 'bold' })}>본인 인증</h3>

        {#if $query.me.personalIdentity}
          <Chip style={css.raw({ fontSize: '12px', fontWeight: 'bold' })} color="grass">인증 완료</Chip>
        {:else}
          <Chip style={css.raw({ fontSize: '12px', fontWeight: 'bold' })} color="red">인증 필요</Chip>
        {/if}
      </div>
      <p class={css({ fontSize: '15px', color: 'gray.500', wordBreak: 'keep-all' })}>
        {#if $query.me.personalIdentity}
          {dayjs($query.me.personalIdentity.createdAt).formatAsDate()} 에 인증을 진행했어요
        {:else}
          성인물 등 특정 콘텐츠를 이용하려면 본인 인증이 필요해요
        {/if}
      </p>
    </div>
    {#if !$query.me.personalIdentity}
      <div class={flex({ gap: '8px' })}>
        <Button color="secondary" size="md" on:click={handleUserIdentityVerification}>SMS 인증</Button>
        <Button color="tertiary" size="md" variant="outlined" on:click={() => (verifyPassportIdentityOpen = true)}>
          여권 인증
        </Button>
      </div>
    {/if}
  </div>

  <hr class={css({ borderStyle: 'none', backgroundColor: 'gray.300', height: '1px' })} />

  <h3 class={css({ fontSize: '18px', fontWeight: 'bold' })}>연동 관리</h3>

  <UserSingleSignOn $user={$query.me} provider="GOOGLE" />
  <UserSingleSignOn $user={$query.me} provider="NAVER" />
  <UserSingleSignOn $user={$query.me} provider="TWITTER" />

  <hr class={css({ borderStyle: 'none', backgroundColor: 'gray.300', height: '1px' })} />

  <div class={flex({ align: 'center', justify: 'space-between', flexWrap: 'wrap', gap: '16px' })}>
    <div>
      <h3 class={css({ marginBottom: '8px', fontSize: '18px', fontWeight: 'bold' })}>이벤트 등 펜슬 소식 받아보기</h3>
      {#if $query.me.marketingConsent}
        <p class={css({ fontSize: '15px', color: 'gray.500', wordBreak: 'keep-all' })}>
          {dayjs($query.me.marketingConsent.createdAt).formatAsDate()} 승인됨
        </p>
      {/if}
    </div>
    <Switch
      checked={!!$query.me.marketingConsent}
      on:change={async () => {
        const consent = !$query.me.marketingConsent;
        await updateUserMarketingConsent({ consent });
        mixpanel.track('user:marketing_consent:update', { consent });

        // TODO: Alert
        // toast.success(`${dayjs().formatAsDate()} ${consent ? '승인' : '거부'} 처리되었어요`, {
        //   title: '펜슬 마케팅 수신 동의',
        // });
      }}
    />
  </div>

  <hr class={css({ borderStyle: 'none', backgroundColor: 'gray.300', height: '1px' })} />

  <div class={flex({ justify: 'flex-end' })}>
    <Button href="/me/settings/deactivate" size="lg" type="link" variant="text">
      탈퇴하기
      <Icon icon={IconChevronRight} />
    </Button>
  </div>
</div>

<UpdateEmailModal bind:open={updateEmailOpen} />
<UpdateProfileModal $profile={$query.me.profile} bind:open={updateProfileOpen} />
<VerifyPassportIdentityModal bind:open={verifyPassportIdentityOpen} />
