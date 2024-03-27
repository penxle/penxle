<script lang="ts">
  import mixpanel from 'mixpanel-browser';
  import IconCheck from '~icons/tabler/check';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import IconPlus from '~icons/tabler/plus';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Helmet, Icon, Image, PostCard, Tag } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../LoginRequireModal.svelte';

  let loginRequireOpen = false;

  $: query = graphql(`
    query SearchPage_Query($query: String!) {
      me {
        id
      }

      searchPosts(query: $query) {
        count

        posts {
          id
          ...Feed_post
        }
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

      searchTags(query: $query) {
        id
        name
      }
    }
  `);

  const followSpace = graphql(`
    mutation SearchPage_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation SearchPage_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
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
  약 {$query.searchPosts.count}개의 검색결과가 있어요!
</div>

<TabHead
  style={css.raw({
    fontSize: '18px',
    width: 'full',
    smDown: {
      position: 'sticky',
      zIndex: '1',
      top: '56px',
    },
  })}
  {search}
>
  <TabHeadItem id={0} pathname="/search">전체</TabHeadItem>
  <TabHeadItem id={1} pathname="/search/post">포스트</TabHeadItem>
  <TabHeadItem id={2} pathname="/search/space">스페이스</TabHeadItem>
  <TabHeadItem id={3} pathname="/search/tag">태그</TabHeadItem>
</TabHead>

<div class={flex({ gap: '36px', marginY: '36px', smDown: { flexDirection: 'column' } })}>
  <div class={css({ flexGrow: '1', width: '1/2', smDown: { paddingX: '16px', width: 'full' } })}>
    <svelte:element
      this={$query.searchSpaces.length === 0 ? 'h2' : 'a'}
      class={flex({ align: 'center', marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' })}
      href={$query.searchSpaces.length === 0 ? undefined : `/search/space?q=${$page.url.searchParams.get('q')}`}
    >
      스페이스
      {#if $query.searchSpaces.length > 0}
        <Icon style={css.raw({ color: 'gray.500' })} icon={IconChevronRight} size={24} />
      {/if}
    </svelte:element>

    {#if $query.searchSpaces.length === 0}
      <div
        class={center({
          fontSize: '15px',
          fontWeight: 'bold',
          color: 'gray.500',
          textAlign: 'center',
          minHeight: '200px',
        })}
      >
        검색 결과가 없어요
      </div>
    {:else}
      <div class={flex({ flexDirection: 'column', gap: '12px' })}>
        {#each $query.searchSpaces.slice(0, 2) as space (space.id)}
          <div
            class={flex({
              align: 'center',
              gap: '16px',
              borderRadius: '8px',
              padding: '4px',
              _hover: { backgroundColor: 'gray.100' },
            })}
          >
            <a href={`/${space.slug}`}>
              <Image
                style={css.raw({ borderWidth: '1px', borderColor: 'gray.200', borderRadius: '[20px]', size: '60px' })}
                $image={space.icon}
              />
            </a>

            <a
              class={flex({ flexDirection: 'column', gap: '4px', flexGrow: '1', truncate: true })}
              href={`/${space.slug}`}
            >
              <p
                class={css({
                  fontSize: '15px',
                  fontWeight: 'bold',
                  whiteSpace: 'pre-line',
                  lineClamp: '1',
                  wordBreak: 'break-all',
                })}
              >
                {space.name}
              </p>
              <p
                class={css({
                  fontSize: '14px',
                  fontWeight: 'medium',
                  color: 'gray.500',
                  whiteSpace: 'pre-line',
                  lineClamp: '2',
                  wordBreak: 'break-all',
                })}
              >
                {space.description ?? ''}
              </p>
            </a>

            {#if !space.meAsMember}
              {#if space.followed}
                <button
                  class={flex({
                    align: 'center',
                    gap: '4px',
                    shrink: '0',
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
                    shrink: '0',
                    borderRadius: '[48px]',
                    paddingX: '8px',
                    paddingY: '6px',
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
  </div>

  <div class={css({ flexGrow: '1', width: '1/2', smDown: { paddingX: '16px', width: 'full' } })}>
    <svelte:element
      this={$query.searchTags.length === 0 ? 'h2' : 'a'}
      class={flex({ align: 'center', marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' })}
      href={$query.searchTags.length === 0 ? undefined : `/search/tag?q=${$page.url.searchParams.get('q')}`}
    >
      태그
      {#if $query.searchTags.length > 0}
        <Icon style={css.raw({ color: 'gray.500' })} icon={IconChevronRight} size={24} />
      {/if}
    </svelte:element>

    {#if $query.searchTags.length === 0}
      <div
        class={center({
          fontSize: '15px',
          fontWeight: 'bold',
          color: 'gray.500',
          textAlign: 'center',
          minHeight: '200px',
        })}
      >
        검색 결과가 없어요
      </div>
    {:else}
      <div class={flex({ flexWrap: 'wrap', gap: '12px' })}>
        {#each $query.searchTags.slice(0, 6) as tag (tag.id)}
          <Tag href={`/tag/${tag.name}`} size="lg">#{tag.name}</Tag>
        {/each}
      </div>
    {/if}
  </div>
</div>

<div>
  <svelte:element
    this={$query.searchPosts.count === 0 ? 'h2' : 'a'}
    class={flex({ align: 'center', fontSize: '20px', fontWeight: 'bold', smDown: { paddingX: '16px' } })}
    href={$query.searchPosts.count === 0 ? undefined : `/search/post?q=${$page.url.searchParams.get('q')}`}
  >
    포스트
    {#if $query.searchPosts.count > 0}
      <Icon style={css.raw({ color: 'gray.500' })} icon={IconChevronRight} size={24} />
    {/if}
  </svelte:element>

  {#if $query.searchPosts.count === 0}
    <div
      class={center({
        fontSize: '15px',
        fontWeight: 'bold',
        color: 'gray.500',
        textAlign: 'center',
        minHeight: '200px',
      })}
    >
      검색 결과가 없어요
    </div>
  {:else}
    <div class={css({ smDown: { backgroundColor: 'gray.50' } })}>
      {#each $query.searchPosts.posts as post (post.id)}
        <PostCard style={css.raw({ marginTop: '16px' })} $post={post} />
      {/each}
    </div>
  {/if}
</div>

<LoginRequireModal bind:open={loginRequireOpen} />
