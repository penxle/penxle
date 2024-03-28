<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import IconSelector from '~icons/tabler/selector';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Icon } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { pageSubTitle } from '$lib/stores';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';

  onMount(async () => {
    pageSubTitle.set('독자 관리');
  });

  $: query = graphql(`
    query SpaceDashboardSubscribersBlockedPage_Query($slug: String!) {
      space(slug: $slug) {
        id

        blockedMasquerades {
          id
          blockedAt

          profile {
            id
            name
          }
        }
      }
    }
  `);

  const unblockMasquerade = graphql(`
    mutation SpaceDashboardSubscribersBlockedPage_UnblockMasquerade_Mutation($input: UnblockMasqueradeInput!) {
      unblockMasquerade(input: $input) {
        id

        blockedMasquerades {
          id
        }
      }
    }
  `);
</script>

<h1 class={css({ marginBottom: '24px', fontSize: '20px', fontWeight: 'bold', hideBelow: 'sm' })}>독자 관리</h1>

<div class={css({ smDown: { backgroundColor: 'gray.5' } })}>
  <TabHead style={css.raw({ fontSize: '18px', paddingLeft: '0' })}>
    <TabHeadItem id={0} pathname="/{$page.params.space}/dashboard/subscribers/blocked">차단 계정</TabHeadItem>
  </TabHead>
</div>

{#if $query.space.blockedMasquerades.length === 0}
  <div class={center({ flexDirection: 'column', gap: '4px', flexGrow: '1', marginY: '120px' })}>
    <Icon icon={IconAlertTriangle} size={28} />
    <p class={css({ marginY: 'auto', fontWeight: 'semibold', textAlign: 'center' })}>차단 유저가 없어요</p>
  </div>
{:else}
  <section
    class={flex({
      flexDirection: 'column',
      gap: '16px',
      borderRadius: '12px',
      padding: { base: '16px', sm: '24px' },
      backgroundColor: 'gray.5',
      smDown: { marginY: '20px', marginX: '16px' },
    })}
  >
    <table class={css({ borderSpacing: '0' })}>
      <thead>
        <tr class={css({ fontSize: '14px', fontWeight: 'semibold', backgroundColor: 'gray.50' })}>
          <th class={css({ paddingY: '8px', paddingLeft: '20px', lg: { width: '120px' }, hideBelow: 'sm' })}>
            <button class={flex({ align: 'center', gap: '4px' })} type="button">
              차단일자
              <Icon icon={IconSelector} />
            </button>
          </th>
          <th class={css({ paddingX: '10px', paddingY: '8px', textAlign: 'left' })}>아이디(익명)</th>
          <th class={css({ paddingY: '8px' })} />
        </tr>
      </thead>
      <tbody>
        {#each $query.space.blockedMasquerades as masquerade (masquerade.id)}
          <tr>
            <td
              class={css({
                borderTopWidth: '1px',
                borderColor: 'gray.200',
                paddingLeft: '20px',
                fontSize: '14px',
                color: 'gray.600',
                hideBelow: 'sm',
              })}
            >
              {dayjs(masquerade.blockedAt).formatAsDate()}
            </td>
            <td
              class={css({
                borderTopWidth: '1px',
                borderColor: 'gray.200',
                paddingX: '10px',
                paddingY: '12px',
                fontSize: '14px',
                color: 'gray.600',
              })}
            >
              {masquerade.profile.name}
            </td>
            <td
              class={css({
                borderTopWidth: '1px',
                borderColor: 'gray.200',
                paddingY: '12px',
                paddingRight: '6px',
                textAlign: 'right',
              })}
            >
              <button
                class={css({
                  borderRadius: '4px',
                  paddingX: '14px',
                  paddingY: '6px',
                  fontSize: '11px',
                  fontWeight: 'semibold',
                  color: '[#DC2626]',
                  _hover: { backgroundColor: 'gray.50' },
                })}
                type="button"
                on:click={async () => {
                  await unblockMasquerade({ spaceId: $query.space.id, masqueradeId: masquerade.id });
                  mixpanel.track('space:masquerade:unblock', { masqueradeId: masquerade.id, spaceId: $query.space.id });
                }}
              >
                차단해제
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}
