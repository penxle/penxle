<script lang="ts">
  import IconLock from '~icons/tabler/lock';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Icon, Modal } from '$lib/components';
  import { PopupSearch } from '$lib/components/forms';
  import Image from '$lib/components/Image.svelte';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { MeCabinetsPage_FollowSpaceModal_user } from '$glitch';

  let _user: MeCabinetsPage_FollowSpaceModal_user;
  export { _user as $user };
  export let open = false;

  let followedSpaces: typeof $user.followedSpaces | undefined;
  let query = '';

  const setSpaces = () => {
    followedSpaces = $user.followedSpaces;
  };

  $: if (open) {
    setSpaces();
  }

  $: user = fragment(
    _user,
    graphql(`
      fragment MeCabinetsPage_FollowSpaceModal_user on User {
        id

        followedSpaces {
          id
          slug
          name
          description
          followed
          visibility

          icon {
            id
            ...Image_image
          }
        }
      }
    `),
  );

  const followSpace = graphql(`
    mutation MeCabinetsPage_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation MeCabinetsPage_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
      unfollowSpace(input: $input) {
        id
        followed
      }
    }
  `);

  $: filteredSpaces = followedSpaces?.filter((space) => space.name.includes(query));
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">관심 스페이스</svelte:fragment>

  <PopupSearch
    style={css.raw({ marginBottom: '16px' }, followedSpaces?.length === 0 && { display: 'none' })}
    on:input={(event) => (query = event.currentTarget.value.trim())}
  />

  <ul
    class={css(
      {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '160px',
        maxHeight: '240px',
        overflowY: 'auto',
      },
      filteredSpaces?.length === 0 && { justifyContent: 'center' },
    )}
  >
    {#each filteredSpaces ?? [] as space (space.id)}
      <li class={flex({ align: 'center', justify: 'space-between' })}>
        <svelte:element
          this={space.visibility === 'PRIVATE' ? 'div' : 'a'}
          class={flex({ gap: '8px', grow: '1', marginRight: '8px', truncate: true })}
          href={space.visibility === 'PRIVATE' ? undefined : `/${space.slug}`}
        >
          <Image
            style={css.raw({
              flex: 'none',
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '8px',
              size: '42px',
            })}
            $image={space.icon}
          />
          <div class={css({ truncate: true })}>
            <div class={flex({ align: 'center', gap: '4px' })}>
              <p class={css({ fontSize: '15px', fontWeight: 'bold', truncate: true })}>
                {space.name}
              </p>
              {#if space.visibility === 'PRIVATE'}
                <span
                  class={flex({
                    align: 'center',
                    borderRadius: 'full',
                    paddingX: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'gray.500',
                    textWrap: 'nowrap',
                    backgroundColor: 'gray.100',
                  })}
                >
                  비공개
                  <Icon style={css.raw({ marginBottom: '2px' })} icon={IconLock} size={12} />
                </span>
              {/if}
            </div>
            <p class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500', truncate: true })}>
              {space.description ?? ''}
            </p>
          </div>
        </svelte:element>
        {#if $user.followedSpaces.find((follow) => follow.id === space.id)}
          <Button
            style={css.raw({ flex: 'none' })}
            color="tertiary"
            size="md"
            variant="outlined"
            on:click={async () => {
              await unfollowSpace({ spaceId: space.id });
              mixpanel.track('space:unfollow', { spaceId: space.id, via: 'cabinet' });
            }}
          >
            해제
          </Button>
        {:else}
          <Button
            style={css.raw({ flex: 'none' })}
            color="secondary"
            size="md"
            on:click={async () => {
              await followSpace({ spaceId: space.id });
              mixpanel.track('space:follow', { spaceId: space.id, via: 'cabinet' });
            }}
          >
            등록
          </Button>
        {/if}
      </li>
    {:else}
      <article class={css({ fontWeight: 'medium', textAlign: 'center', color: 'gray.500', wordBreak: 'keep-all' })}>
        {#if followedSpaces}
          {followedSpaces.length === 0 ? '아직 추가된 관심 스페이스가 없어요' : '일치하는 검색 결과가 없어요'}
        {/if}
      </article>
    {/each}
  </ul>
</Modal>
