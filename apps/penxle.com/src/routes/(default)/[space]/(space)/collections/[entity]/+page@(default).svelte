<script lang="ts">
  import mixpanel from 'mixpanel-browser';
  import IconAlignBoxLeftMiddle from '~icons/tabler/align-box-left-middle';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import IconList from '~icons/tabler/list';
  import IconSettings from '~icons/tabler/settings';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Button, Helmet, Icon, Image, SpacePostCard } from '$lib/components';
  import { ManageCollectionModal } from '$lib/components/pages/collections';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../../../LoginRequireModal.svelte';

  let openPostManageCollectionModal = false;
  let loginRequireOpen = false;

  let prevScrollpos = 0;
  let bottomNavShow = true;

  $: query = graphql(`
    query SpaceCollectionsEnitityPage_Query($slug: String!) {
      me {
        id
      }

      space(slug: $slug) {
        id
        slug
        name
        followed

        posts {
          id
          collection {
            id
          }

          ...SpaceCollectionsEnitityPage_ManageCollectionModal_post
        }

        icon {
          ...Image_image
        }

        description

        collections {
          id
          name
          count
          thumbnail {
            id
            url
            ...Image_image
          }

          posts {
            id
            ...SpaceFeed_post
          }

          ...SpaceCollectionsEnitityPage_ManageCollectionModal_collection
        }

        meAsMember {
          id
        }
      }
    }
  `);
  $: collectionId = $page.params.entity;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  $: collection = $query.space.collections.find(({ id }) => id === collectionId)!;

  const followSpace = graphql(`
    mutation SpaceCollectionPage_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation SpaceCollectionPage_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
      unfollowSpace(input: $input) {
        id
        followed
      }
    }
  `);
</script>

<Helmet
  description={`${$query.space.name} 스페이스의 ${collection.name} 컬렉션`}
  title={`${$query.space.name}의 ${collection.name}`}
/>

<svelte:window
  on:scroll={(e) => {
    if (e.currentTarget.innerWidth <= 800) {
      const currentScrollPos = e.currentTarget.scrollY;

      bottomNavShow = prevScrollpos > currentScrollPos;
      prevScrollpos = currentScrollPos;
    }
  }}
/>

{#if $query.space.meAsMember}
  <div
    class={css({
      position: 'fixed',
      bottom: bottomNavShow ? '0' : '-80px',
      paddingX: '16px',
      paddingY: '10px',
      width: 'full',
      backgroundColor: 'gray.5',
      transition: 'all',
      zIndex: '1',
      hideFrom: 'sm',
    })}
  >
    <Button style={css.raw({ width: 'full' })} size="xl" on:click={() => (openPostManageCollectionModal = true)}>
      포스트 관리
    </Button>
  </div>
{/if}

<section
  class={flex({
    direction: 'column',
    align: 'center',
    grow: '1',
    width: 'full',
    backgroundColor: { base: 'gray.100', sm: 'gray.5' },
  })}
>
  <header
    style={typeof collection?.thumbnail?.url === 'string'
      ? `background-image: linear-gradient(transparent, rgba(0, 0, 0, 0.8)), url(${collection.thumbnail.url})`
      : ''}
    class={flex({
      justify: 'center',
      align: 'flex-end',
      padding: '24px',
      width: 'full',
      height: '206px',
      color: 'gray.5',
      backgroundColor: 'gray.900/50',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    })}
  >
    <div class={css({ flex: '1', maxWidth: '1200px' })}>
      <a class={css({ fontSize: '14px', fontWeight: 'semibold' })} href="/{$query.space?.slug}">{$query.space.name}</a>
      <h1 class={css({ marginBottom: '8px', fontSize: '20px', fontWeight: 'bold' })}>{collection?.name}</h1>
      <div
        class={flex({
          justify: 'space-between',
          align: 'center',
          gap: '4px',
          wrap: 'wrap',
          alignSelf: 'center',
          width: 'full',
          maxWidth: '1200px',
        })}
      >
        <p class={css({ fontSize: '14px', fontWeight: 'medium' })}>
          <Icon style={css.raw({ marginRight: '4px', verticalAlign: 'sub' })} icon={IconAlignBoxLeftMiddle} />
          {collection?.count}개의 포스트
        </p>
        {#if $query.space.meAsMember}
          <div class={flex({ gap: '8px', wrap: 'wrap' })} role="group">
            <Button
              style={flex.raw({ gap: '4px', color: 'gray.5', _disabled: { visibility: 'hidden' } })}
              color="tertiary"
              size="sm"
              variant="outlined"
              on:click={() => (openPostManageCollectionModal = true)}
            >
              포스트 관리 <Icon icon={IconList} />
            </Button>
            <Button
              style={flex.raw({ gap: '4px', color: 'gray.5', _disabled: { visibility: 'hidden' } })}
              color="tertiary"
              href="/{$query.space.slug}/dashboard/posts/collections"
              size="sm"
              type="link"
              variant="outlined"
            >
              컬렉션 관리 <Icon icon={IconSettings} />
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <article class={flex({ flex: '1', width: 'full', sm: { paddingX: '24px' } })}>
    <div
      class={flex({
        marginX: 'auto',
        width: 'full',
        maxWidth: '1200px',
        sm: { gap: '32px', marginY: '36px' },
        smDown: { flexDirection: 'column', gap: '8px' },
      })}
    >
      {#if collection?.count}
        <ul
          class={flex({
            direction: 'column',
            gap: { base: '8px', sm: '32px' },
            flex: '1',
            sm: { maxWidth: '[calc(100% - 295px)]' },
          })}
        >
          {#each collection.posts as post (post.id)}
            <li><SpacePostCard $post={post} /></li>
          {/each}
        </ul>
      {:else}
        <section
          class={center({
            flexDirection: 'column',
            gap: '32px',
            flex: '1',
            sm: { maxWidth: '[calc(100% - 295px)]' },
            smDown: { minHeight: '320px' },
          })}
        >
          <div class={css({ textAlign: 'center', fontSize: '15px', fontWeight: 'semibold', wordBreak: 'keep-all' })}>
            아직 컬렉션에 추가된 포스트가 없어요
          </div>
          {#if $query.space.meAsMember && !$query.space.posts.every((post) => post.collection?.id)}
            <Button
              size="lg"
              on:click={() => {
                openPostManageCollectionModal = true;
              }}
            >
              포스트 추가하기
            </Button>
          {/if}
        </section>
      {/if}

      <aside class={css({ width: 'full', sm: { maxWidth: '295px' } })}>
        <section
          class={center({
            padding: '24px',
            backgroundColor: 'gray.50',
            sm: { flexDirection: 'column', borderRadius: '16px', marginBottom: '16px' },
            smDown: { gap: '16px', paddingY: '16px' },
          })}
        >
          <a href="/{$query.space?.slug}">
            <Image
              style={css.raw({
                flex: 'none',
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '16px',
                size: '64px',
                sm: { marginBottom: '16px', size: '60px' },
              })}
              $image={$query.space.icon}
            />
          </a>
          <hgroup
            class={css({
              flex: '1',
              wordBreak: 'keep-all',
              sm: { marginBottom: '8px', width: 'full', textAlign: 'center' },
            })}
          >
            <a
              class={flex({ marginBottom: '8px', sm: { justifyContent: 'center', alignItems: 'center' } })}
              href="/{$query.space?.slug}"
            >
              <h2 class={css({ fontSize: { base: '15px', sm: '18px' }, fontWeight: 'bold' })}>
                {$query.space.name}
              </h2>
              <Icon style={css.raw({ color: 'gray.400', hideBelow: 'sm' })} icon={IconChevronRight} size={20} />
            </a>
            <a href="/{$query.space?.slug}">
              <p
                class={css({
                  fontSize: { base: '14px', sm: '15px' },
                  fontWeight: { base: 'medium', sm: 'semibold' },
                  color: 'gray.500',
                  whiteSpace: 'pre-wrap',
                })}
              >
                {$query.space.description ?? '아직 소개가 없어요'}
              </p>
            </a>
          </hgroup>
          {#if !$query.space.meAsMember}
            {#if $query.space.followed}
              <Button
                style={css.raw({ flex: 'none', borderRadius: 'full' })}
                color="tertiary"
                size="md"
                variant="outlined"
                on:click={async () => {
                  await unfollowSpace({ spaceId: $query.space.id });
                  mixpanel.track('space:unfollow', { spaceId: $query.space.id, via: 'collection' });
                }}
              >
                관심 해제
              </Button>
            {:else}
              <Button
                style={css.raw({ flex: 'none', borderRadius: 'full' })}
                size="md"
                on:click={async () => {
                  if (!$query.me) {
                    loginRequireOpen = true;
                    return;
                  }

                  await followSpace({ spaceId: $query.space.id });
                  mixpanel.track('space:follow', { spaceId: $query.space.id, via: 'collection' });
                }}
              >
                + 관심
              </Button>
            {/if}
          {/if}
        </section>
        <section
          class={css({ smDown: { marginTop: '8px', paddingX: '16px', paddingY: '8px', backgroundColor: 'gray.50' } })}
        >
          {#if $query.space.collections.length > 1}
            <h2 class={css({ marginBottom: { base: '12px', sm: '8px' }, fontSize: '14px', fontWeight: 'bold' })}>
              이 스페이스의 다른 컬렉션
            </h2>

            <ul
              class={flex({ sm: { flexDirection: 'column', gap: '8px' }, smDown: { gap: '12px', overflowX: 'auto' } })}
            >
              {#each $query.space.collections as collection (collection.id)}
                {#if collection.id !== collectionId}
                  <li>
                    <a
                      class={flex({
                        gap: '12px',
                        padding: '8px',
                        sm: { borderRadius: '12px', backgroundColor: { _hover: 'gray.50', _focus: 'gray.50' } },
                        smDown: { flexDirection: 'column', width: '120px' },
                      })}
                      href={`/${$query.space.slug}/collections/${collection.id}`}
                    >
                      {#if collection.thumbnail}
                        <Image
                          style={css.raw({ borderRadius: '8px', width: '96px', height: '120px' })}
                          $image={collection.thumbnail}
                        />
                      {/if}
                      <dl class={css({ paddingY: '8px' })}>
                        <dt
                          class={css({
                            marginBottom: '4px',
                            fontWeight: 'bold',
                            smDown: { minWidth: '0', lineClamp: 2 },
                          })}
                        >
                          {collection.name}
                        </dt>
                        <dd class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.500' })}>
                          {collection.count}개의 포스트
                        </dd>
                      </dl>
                    </a>
                  </li>
                {/if}
              {/each}
            </ul>
          {/if}
        </section>
      </aside>
    </div>
  </article>
</section>

{#if collection}
  <ManageCollectionModal
    $collection={collection}
    $posts={$query.space.posts}
    spaceId={$query.space.id}
    bind:open={openPostManageCollectionModal}
  />
{/if}

<LoginRequireModal bind:open={loginRequireOpen} />
