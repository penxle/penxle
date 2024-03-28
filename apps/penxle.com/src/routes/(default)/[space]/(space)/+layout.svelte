<script lang="ts">
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import IconLock from '~icons/tabler/lock';
  import IconSettings from '~icons/tabler/settings';
  import IconShare2 from '~icons/tabler/share-2';
  import { goto } from '$app/navigation';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { BottomSheet, Button, Icon, Image } from '$lib/components';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { toast } from '$lib/notification';
  import { handleShare } from '$lib/utils';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../LoginRequireModal.svelte';

  let moveToLoginOpen = false;
  let menuOpen = false;
  let revealMutedSpace = false;

  $: query = graphql(`
    query SpaceLayout_Query($slug: String!) {
      me {
        id
      }

      space(slug: $slug) {
        id
        slug
        name
        muted
        followed
        followerCount
        postCount
        visibility

        # externalLinks {
        #   id
        #   url
        # }

        icon {
          id
          ...Image_image
        }

        meAsMember {
          id
          role
        }
      }
    }
  `);

  const followSpace = graphql(`
    mutation SpaceLayout_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
        followerCount
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation SpaceLayout_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
      unfollowSpace(input: $input) {
        id
        followed
        followerCount
      }
    }
  `);

  const muteSpace = graphql(`
    mutation SpaceLayout_MuteSpace_Mutation($input: MuteSpaceInput!) {
      muteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  const unmuteSpace = graphql(`
    mutation SpaceLayout_UnmuteSpace_Mutation($input: UnmuteSpaceInput!) {
      unmuteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  const createPost = graphql(`
    mutation SpaceLayout_CreatePost_Mutation($input: CreatePostInput!) {
      createPost(input: $input) {
        id
        permalink
      }
    }
  `);
</script>

<main class={flex({ direction: 'column', align: 'center', grow: '1', width: 'full', background: 'gray.5' })}>
  <div
    class={css({
      paddingTop: '24px',
      paddingX: '16px',
      width: 'full',
      maxWidth: '800px',
      backgroundColor: 'gray.5',
      sm: { display: 'flex', marginBottom: '32px' },
    })}
  >
    <div class={flex({ justify: 'space-between', align: 'flex-start' })}>
      <Image
        style={css.raw({
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderRadius: '16px',
          size: '60px',
          sm: { borderRadius: '[24px]', marginRight: '24px', size: '120px' },
        })}
        $image={$query.space.icon}
      />
      <div class={flex()}>
        <button
          class={center({
            borderRadius: '12px',
            size: '36px',
            transition: 'common',
            _hover: { backgroundColor: 'gray.50' },
            hideFrom: 'sm',
          })}
          type="button"
          on:click={() => {
            handleShare($query.space.name, `${location.origin}/${$query.space.slug}`);
          }}
        >
          <Icon style={css.raw({ color: 'gray.400' })} icon={IconShare2} size={24} />
        </button>
        {#if !$query.space.meAsMember}
          <button
            class={center({
              borderRadius: '12px',
              size: '36px',
              transition: 'common',
              _hover: { backgroundColor: 'gray.50' },
              hideFrom: 'sm',
            })}
            type="button"
            on:click={() => {
              menuOpen = true;
            }}
          >
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconDotsVertical} size={24} />
          </button>
        {/if}
      </div>
    </div>
    <div class={css({ flex: '1', sm: { marginRight: '24px' } })}>
      <div class={css({ marginTop: '20px', truncate: true, sm: { marginTop: '0', marginBottom: '12px' } })}>
        <h1
          class={flex({
            align: 'center',
            gap: '4px',
            wrap: 'wrap',
            marginBottom: { base: '8px', sm: '12px' },
            fontSize: { base: '20px', sm: '24px' },
            fontWeight: 'bold',
            truncate: true,
          })}
        >
          {$query.space.name}

          {#if $query.space.visibility === 'PRIVATE'}
            <span
              class={center({
                borderRadius: '16px',
                paddingX: '6px',
                paddingY: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: 'gray.500',
                backgroundColor: 'gray.100',
                textWrap: 'nowrap',
              })}
            >
              비공개
              <Icon style={css.raw({ marginBottom: '2px' })} icon={IconLock} size={12} />
            </span>
          {/if}
        </h1>

        <div class={flex({ align: 'center', marginBottom: '8px' })}>
          <span class={css({ fontWeight: 'semibold', color: 'gray.500' })}>관심 독자</span>
          <span class={css({ marginLeft: '8px', fontSize: '18px', fontWeight: 'bold' })}>
            {$query.space.followerCount}
          </span>
          <span class={css({ marginLeft: '12px', fontWeight: 'semibold', color: 'gray.500' })}>포스트</span>
          <span class={css({ marginLeft: '8px', fontSize: '18px', fontWeight: 'bold' })}>{$query.space.postCount}</span>
        </div>
      </div>
    </div>
    <div class={flex({ align: 'center', gap: '8px', alignSelf: 'flex-start', hideBelow: 'sm' })}>
      {#if $query.space.meAsMember}
        <Button
          size="md"
          on:click={async () => {
            const { permalink } = await createPost({ spaceId: $query.space.id });
            mixpanel.track('post:create', { via: 'space' });
            await goto(`/editor/${permalink}`);
          }}
        >
          포스트 작성
        </Button>
        <Button
          color="tertiary"
          size="md"
          variant="outlined"
          on:click={() => {
            handleShare($query.space.name, `${location.origin}/${$query.space.slug}`);
          }}
        >
          <Icon style={css.raw({ marginRight: '8px' })} icon={IconShare2} />
          공유하기
        </Button>
        <a
          class={center({
            borderWidth: '1px',
            borderColor: { base: 'gray.200', _hover: 'gray.400' },
            borderRadius: '12px',
            padding: '4px',
            size: '36px',
            transition: 'common',
          })}
          href={`/${$query.space.slug}/dashboard/settings`}
        >
          <Icon style={css.raw({ color: 'gray.500' })} icon={IconSettings} size={24} />
        </a>
      {:else}
        {#if $query.me === null}
          <Button
            style={css.raw({ flex: '1' })}
            size="md"
            on:click={() => {
              moveToLoginOpen = true;
            }}
          >
            + 관심
          </Button>
        {:else if $query.space.followed}
          <Button
            style={css.raw({ flex: '1' })}
            color="tertiary"
            size="md"
            variant="outlined"
            on:click={async () => {
              await unfollowSpace({ spaceId: $query.space.id });
              mixpanel.track('space:unfollow', { spaceId: $query.space.id, via: 'space' });
              toast.success('관심 스페이스 해제되었어요');
            }}
          >
            관심 해제
          </Button>
        {:else}
          <Button
            style={css.raw({ flex: '1' })}
            size="md"
            on:click={async () => {
              await followSpace({ spaceId: $query.space.id });
              mixpanel.track('space:follow', { spaceId: $query.space.id, via: 'space' });
              toast.success('관심 스페이스로 등록되었어요');
            }}
          >
            + 관심
          </Button>
        {/if}
        <Button
          color="tertiary"
          size="md"
          variant="outlined"
          on:click={() => {
            handleShare($query.space.name, `${location.origin}/${$query.space.slug}`);
          }}
        >
          <Icon style={css.raw({ marginRight: '8px' })} icon={IconShare2} />
          공유하기
        </Button>
        {#if !$query.space.meAsMember}
          <Menu
            style={center.raw({
              borderWidth: '1px',
              borderColor: { base: 'gray.200', _hover: 'gray.400' },
              borderRadius: '12px',
              padding: '4px',
              size: '36px',
              transition: 'common',
            })}
          >
            <Icon slot="value" style={css.raw({ color: 'gray.500' })} icon={IconDotsVertical} size={24} />

            {#if $query.space.muted}
              <MenuItem
                on:click={async () => {
                  await unmuteSpace({ spaceId: $query.space.id });
                  mixpanel.track('space:unmute', { spaceId: $query.space.id, via: 'space' });
                  toast.success('스페이스 숨기기 해제되었어요');
                }}
              >
                스페이스 숨기기 해제
              </MenuItem>
            {:else}
              <MenuItem
                on:click={async () => {
                  await muteSpace({ spaceId: $query.space.id });
                  mixpanel.track('space:mute', { spaceId: $query.space.id, via: 'space' });
                  toast.success('스페이스를 숨겼어요');
                }}
              >
                스페이스 숨기기
              </MenuItem>
            {/if}
            <MenuItem>스페이스 신고하기</MenuItem>
          </Menu>
        {/if}
      {/if}
    </div>
  </div>
  <div
    class={flex({
      gap: '8px',
      marginTop: '24px',
      marginBottom: '12px',
      paddingX: '16px',
      width: 'full',
      hideFrom: 'sm',
    })}
  >
    {#if $query.space.meAsMember}
      <Button
        style={css.raw({ smDown: { width: 'full' } })}
        size="xl"
        on:click={async () => {
          const { permalink } = await createPost({ spaceId: $query.space.id });
          mixpanel.track('post:create', { via: 'space' });
          await goto(`/editor/${permalink}`);
        }}
      >
        포스트 작성
      </Button>
      <Button
        style={css.raw({ size: '50px' })}
        color="tertiary"
        href={`/${$query.space.slug}/dashboard/settings`}
        size="xl"
        type="link"
        variant="outlined"
      >
        <Icon style={css.raw({ color: 'gray.500' })} icon={IconSettings} size={24} />
      </Button>
    {:else if $query.me === null}
      <Button
        style={css.raw({ width: 'full' })}
        size="xl"
        on:click={() => {
          moveToLoginOpen = true;
        }}
      >
        관심 스페이스 등록하기
      </Button>
    {:else if $query.space.followed}
      <Button
        style={css.raw({ width: 'full' })}
        color="tertiary"
        size="xl"
        variant="outlined"
        on:click={async () => {
          await unfollowSpace({ spaceId: $query.space.id });
          mixpanel.track('space:unfollow', { spaceId: $query.space.id, via: 'space' });
          toast.success('관심 스페이스 해제되었어요');
        }}
      >
        관심 스페이스 해제하기
      </Button>
    {:else}
      <Button
        style={css.raw({ width: 'full' })}
        size="xl"
        on:click={async () => {
          await followSpace({ spaceId: $query.space.id });
          mixpanel.track('space:follow', { spaceId: $query.space.id, via: 'space' });
          toast.success('관심 스페이스로 등록되었어요');
        }}
      >
        관심 스페이스 등록하기
      </Button>
    {/if}
  </div>

  <TabHead style={css.raw({ borderWidth: '0', width: 'full', maxWidth: '800px' })} variant="secondary">
    <TabHeadItem id={1} pathname="/{$query.space.slug}">
      <span>홈</span>
    </TabHeadItem>
    <TabHeadItem id={2} pathname="/{$query.space.slug}/collections">
      <span>컬렉션</span>
    </TabHeadItem>
    <TabHeadItem id={3} pathname="/{$query.space.slug}/about">
      <span>소개</span>
    </TabHeadItem>
  </TabHead>

  <hr class={css({ borderColor: 'gray.900/10', width: 'full' })} />

  {#if $query.space.muted && !revealMutedSpace}
    <div
      class={center({
        flexDirection: 'column',
        flexGrow: 'grow',
        width: 'full',
        maxWidth: '800px',
        minHeight: '176px',
        fontSize: '15px',
        fontWeight: 'semibold',
        color: 'gray.500',
      })}
    >
      <p>내가 숨긴 스페이스예요</p>
      <p>내용을 보시겠어요?</p>
      <p>(스페이스 숨김은 유지돼요)</p>
      <Button style={css.raw({ marginTop: '20px', width: 'fit' })} size="lg" on:click={() => (revealMutedSpace = true)}>
        내용 보기
      </Button>
    </div>
  {:else}
    <slot />
  {/if}
</main>

<LoginRequireModal bind:open={moveToLoginOpen} />

<BottomSheet bind:open={menuOpen}>
  <div class={css({ paddingY: '8px', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' })}>더보기</div>

  <div class={css({ marginTop: '8px' })}>
    {#if $query.space.muted}
      <button
        class={css({
          borderRadius: '16px',
          paddingX: '12px',
          width: 'full',
          height: '56px',
          textAlign: 'center',
          fontWeight: 'semibold',
          color: 'gray.500',
          _hover: { backgroundColor: 'gray.50' },
        })}
        type="button"
        on:click={async () => {
          await unmuteSpace({ spaceId: $query.space.id });
          mixpanel.track('space:unmute', { spaceId: $query.space.id, via: 'space' });
          toast.success('스페이스 숨기기 해제되었어요');
        }}
      >
        스페이스 숨기기 해제
      </button>
    {:else}
      <button
        class={css({
          borderRadius: '16px',
          paddingX: '12px',
          width: 'full',
          height: '56px',
          textAlign: 'center',
          fontWeight: 'semibold',
          color: 'gray.500',
          _hover: { backgroundColor: 'gray.50' },
        })}
        type="button"
        on:click={async () => {
          await muteSpace({ spaceId: $query.space.id });
          mixpanel.track('space:mute', { spaceId: $query.space.id, via: 'space' });
          toast.success('스페이스를 숨겼어요');
        }}
      >
        스페이스 숨기기
      </button>
    {/if}

    <button
      class={css({
        borderRadius: '16px',
        paddingX: '12px',
        width: 'full',
        height: '56px',
        textAlign: 'center',
        fontWeight: 'semibold',
        color: 'gray.500',
        _hover: { backgroundColor: 'gray.50' },
      })}
      type="button"
    >
      스페이스 신고하기
    </button>
  </div>
</BottomSheet>
