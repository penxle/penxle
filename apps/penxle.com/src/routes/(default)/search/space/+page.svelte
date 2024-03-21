<script lang="ts">
  import mixpanel from 'mixpanel-browser';
  import IconCheck from '~icons/tabler/check';
  import IconPlus from '~icons/tabler/plus';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Helmet, Icon, Image } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { toast } from '$lib/notification';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../LoginRequireModal.svelte';

  let loginRequireOpen = false;

  $: query = graphql(`
    query SearchSpacePage_Query($query: String!) {
      me {
        id
      }

      searchSpaces(query: $query) {
        id
        slug
        name
        description
        followed

        icon {
          id
          ...Image_image
        }

        meAsMember {
          id
        }
      }
    }
  `);

  const followSpace = graphql(`
    mutation SearchSpacePage_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation SearchSpacePage_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
      unfollowSpace(input: $input) {
        id
        followed
      }
    }
  `);

  $: search = `?q=${$page.url.searchParams.get('q')}`;
  $: keyword = $page.url.searchParams.get('q');
</script>

<Helmet description={`펜슬에서 ${keyword} 검색을 한 결과에요`} title={`${keyword} 검색 결과`} />

<div
  class={css({
    marginTop: '12px',
    fontSize: '14px',
    fontWeight: 'medium',
    color: 'gray.500',
    smDown: { marginLeft: '16px' },
  })}
>
  약 {$query.searchSpaces.length ?? 0}개의 검색결과가 있어요!
</div>

<TabHead
  style={css.raw({
    fontSize: '18px',
    width: 'full',
    smDown: { position: 'sticky', zIndex: '1', top: '56px' },
  })}
  {search}
>
  <TabHeadItem id={0} pathname="/search">전체</TabHeadItem>
  <TabHeadItem id={1} pathname="/search/post">포스트</TabHeadItem>
  <TabHeadItem id={2} pathname="/search/space">스페이스</TabHeadItem>
  <TabHeadItem id={3} pathname="/search/tag">태그</TabHeadItem>
</TabHead>

{#if $query.searchSpaces.length === 0}
  <div
    class={center({ fontSize: '15px', fontWeight: 'bold', color: 'gray.500', textAlign: 'center', minHeight: '200px' })}
  >
    검색 결과가 없어요
  </div>
{:else}
  <div class={flex({ flexDirection: 'column', gap: '16px', smDown: { paddingX: '16px' } })}>
    {#each $query.searchSpaces as space (space.id)}
      <div
        class={flex({
          align: 'center',
          gap: '16px',
          borderRadius: '8px',
          padding: '4px',
          _hover: { backgroundColor: 'gray.50' },
        })}
      >
        <a class={css({ flex: 'none' })} href={`/${space.slug}`}>
          <Image
            style={css.raw({
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '[20px]',
              size: '60px',
            })}
            $image={space.icon}
          />
        </a>

        <a class={flex({ flexDirection: 'column', gap: '4px', grow: '1' })} href={`/${space.slug}`}>
          <p class={css({ fontSize: '15px', fontWeight: 'bold' })}>{space.name}</p>
          <p class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.500' })}>{space.description ?? ''}</p>
        </a>

        {#if !space.meAsMember}
          {#if space.followed}
            <button
              class={flex({
                align: 'center',
                gap: '4px',
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '[48px]',
                paddingX: '8px',
                paddingY: '6px',
                fontSize: '13px',
                fontWeight: 'medium',
              })}
              type="button"
              on:click={async () => {
                await unfollowSpace({ spaceId: space.id });
                mixpanel.track('space:unfollow', { spaceId: space.id, via: 'search' });
                toast.success('관심 스페이스 해제되었어요');
              }}
            >
              <Icon icon={IconCheck} />
              관심
            </button>
          {:else}
            <button
              class={flex({
                align: 'center',
                gap: '4px',
                borderRadius: '[48px]',
                paddingX: '8px',
                paddingY: '6px',
                fontSize: '13px',
                fontWeight: 'medium',
                color: 'gray.50',
                backgroundColor: 'gray.900',
              })}
              type="button"
              on:click={async () => {
                if (!$query.me) {
                  loginRequireOpen = true;
                  return;
                }

                await followSpace({ spaceId: space.id });
                mixpanel.track('space:follow', { spaceId: space.id, via: 'search' });
                toast.success('관심 스페이스로 등록되었어요');
              }}
            >
              <Icon icon={IconPlus} />
              관심
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
{/if}

<LoginRequireModal bind:open={loginRequireOpen} />
