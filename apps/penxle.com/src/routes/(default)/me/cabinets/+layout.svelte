<script lang="ts">
  import IconArrowUp from '~icons/tabler/arrow-up';
  import { graphql } from '$glitch';
  import { GridImage, Icon, Link } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import FollowSpaceModal from './FollowSpaceModal.svelte';
  import FollowTagModal from './FollowTagModal.svelte';

  let followingSpaceOpen = false;
  let followingTagOpen = false;
  let scrollTopEl: HTMLButtonElement;

  $: query = graphql(`
    query MeCabinetsLayout_Query {
      auth(scope: USER)

      me @_required {
        id

        followedSpaces {
          id
        }

        followedTags {
          id
        }

        bookmarkGroups {
          id
          postCount

          thumbnails {
            id
            ...Image_image
          }
        }

        ...MeCabinetsPage_FollowSpaceModal_user
        ...MeCabinetsPage_FollowTagModal_user
      }
    }
  `);
</script>

<svelte:window
  on:scroll={({ currentTarget }) => {
    scrollTopEl.style.display = currentTarget.scrollY > 200 ? 'flex' : 'none';
  }}
/>

<h1 class={css({ marginBottom: '24px', fontSize: '20px', fontWeight: 'bold', hideBelow: 'sm' })}>나의 서랍</h1>

<div class={flex({ direction: 'column', gap: { base: '8px', sm: '24px' } })}>
  <div
    class={css({
      paddingX: { base: '20px', sm: '32px' },
      paddingY: '16px',
      backgroundColor: 'gray.5',
      sm: { borderWidth: '1px', borderColor: 'gray.200', borderRadius: '16px' },
    })}
  >
    <h2 class={css({ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold', hideBelow: 'sm' })}>내 관심 관리</h2>
    <div class={flex({ align: 'center' })} role="group">
      <button
        class={center({
          flexDirection: 'column',
          flex: '1',
          borderRadius: '8px',
          marginX: '8px',
          paddingY: '8px',
          _hover: { backgroundColor: 'gray.50' },
          _focus: { backgroundColor: 'gray.50' },
        })}
        type="button"
        on:click={() => (followingSpaceOpen = true)}
      >
        <div class={css({ marginBottom: '8px', fontSize: { base: '20px', sm: '24px' }, fontWeight: 'bold' })}>
          {$query.me.followedSpaces.length}
        </div>
        <div class={css({ fontSize: { base: '13px', sm: '16px' }, fontWeight: 'medium', color: 'gray.500' })}>
          관심 스페이스
        </div>
      </button>
      <hr class={css({ borderRightWidth: '1px', borderColor: 'gray.200', height: '80px' })} />
      <button
        class={center({
          flexDirection: 'column',
          flex: '1',
          borderRadius: '8px',
          marginX: '8px',
          paddingY: '8px',
          _hover: { backgroundColor: 'gray.50' },
          _focus: { backgroundColor: 'gray.50' },
        })}
        type="button"
        on:click={() => (followingTagOpen = true)}
      >
        <div class={css({ marginBottom: '8px', fontSize: { base: '20px', sm: '24px' }, fontWeight: 'bold' })}>
          {$query.me.followedTags.length}
        </div>
        <div class={css({ fontSize: { base: '13px', sm: '16px' }, fontWeight: 'medium', color: 'gray.500' })}>
          관심 태그
        </div>
      </button>
    </div>
  </div>

  <div
    class={flex({
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      backgroundColor: 'gray.5',
      sm: {
        gap: '24px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '16px',
        paddingX: '32px',
        paddingBottom: '24px',
      },
    })}
  >
    <div class={flex({ align: 'center', justify: 'space-between', width: 'full' })}>
      <div>
        <h2 class={css({ fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold' })}>북마크</h2>
      </div>
    </div>

    {#if $query.me.bookmarkGroups.length === 0 || $query.me.bookmarkGroups[0].postCount === 0}
      <p class={css({ paddingY: '8px', fontWeight: 'medium', color: 'gray.500', textAlign: 'center' })}>
        아직 북마크가 없어요
      </p>
    {:else}
      {#each $query.me.bookmarkGroups as bookmark (bookmark.id)}
        <Link style={css.raw({ display: 'inline-block' })} href="/me/cabinets/bookmark">
          {#if bookmark.thumbnails.length > 0}
            <GridImage
              style={css.raw({
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '8px',
                size: { base: '148px', sm: '168px' },
              })}
              images={bookmark.thumbnails}
            />
          {:else}
            <div
              class={center({
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '8px',
                size: { base: '148px', sm: '168px' },
              })}
            >
              <svg class={css({ borderRadius: '8px' })} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect fill="#0c0a091a" height="24" width="24" />
                <path
                  d="M7.36 3.86c2.3 5.04.42 10.01-.1 11.36-.08.23-.13.36-.11.36a15.7 15.7 0 0 1 9.45 4.6l-1.58-2.74L13 14.07a1.1 1.1 0 1 1 .53-.35l3.53 6.11c-1.4-4.68.63-10.12.63-10.12-6.15-.67-10.33-5.85-10.33-5.85Z"
                  fill="#FAFAF9"
                />
              </svg>
            </div>
          {/if}
          <p class={css({ marginTop: '8px', marginBottom: '4px', fontSize: '15px', fontWeight: 'bold' })}>북마크</p>
          <p class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
            {bookmark.postCount}개의 포스트
          </p>
        </Link>
      {/each}
    {/if}
  </div>

  <div
    class={css({
      backgroundColor: 'gray.5',
      paddingY: '16px',
      sm: { borderWidth: '1px', borderColor: 'gray.200', borderRadius: '16px' },
    })}
  >
    <h2 class={css({ paddingX: { base: '16px', sm: '32px' }, fontSize: '20px', fontWeight: 'bold' })}>포스트 목록</h2>

    <TabHead
      style={css.raw({
        marginTop: '16px',
        marginBottom: '24px',
        paddingX: { base: '16px', sm: '32px' },
        width: 'full',
      })}
      variant="secondary"
    >
      <TabHeadItem id={1} pathname="/me/cabinets">이모지</TabHeadItem>
      <TabHeadItem id={2} pathname="/me/cabinets/recent">최근</TabHeadItem>
      <TabHeadItem id={3} pathname="/me/cabinets/purchased">구매</TabHeadItem>
    </TabHead>

    <div class={css({ paddingX: { base: '16px', sm: '32px' } })}>
      <ul class={flex({ flexDirection: 'column', gap: '12px' })}>
        <slot />
      </ul>
    </div>
  </div>
</div>

<button
  bind:this={scrollTopEl}
  class={center({
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    display: 'none',
    borderRadius: 'full',
    backgroundColor: 'gray.900/50',
    size: '50px',
  })}
  type="button"
  on:click={() => {
    scrollTo({ top: 0, behavior: 'smooth' });
  }}
>
  <Icon style={css.raw({ color: '[#FFF9F8]' })} icon={IconArrowUp} size={20} />
</button>

<FollowSpaceModal $user={$query.me} bind:open={followingSpaceOpen} />
<FollowTagModal $user={$query.me} bind:open={followingTagOpen} />
