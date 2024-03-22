<script lang="ts">
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Icon } from '$lib/components';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { toast } from '$lib/notification';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../LoginRequireModal.svelte';

  let loginRequireOpen = false;

  $: query = graphql(`
    query TagLayout_Query($name: String!) {
      me {
        id
      }

      tag(name: $name) {
        id
        name
        followed
        muted

        # parents {
        #   id
        #   name
        # }
      }
    }
  `);

  const followTag = graphql(`
    mutation TagLayout_FollowTag_Mutation($input: FollowTagInput!) {
      followTag(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowTag = graphql(`
    mutation TagLayout_UnfollowTag_Mutation($input: UnfollowTagInput!) {
      unfollowTag(input: $input) {
        id
        followed
      }
    }
  `);

  const muteTag = graphql(`
    mutation TagLayout_MuteTag_Mutation($input: MuteTagInput!) {
      muteTag(input: $input) {
        id
        muted
      }
    }
  `);

  const unmuteTag = graphql(`
    mutation TagLayout_UnmuteTag_Mutation($input: UnmuteTagInput!) {
      unmuteTag(input: $input) {
        id
        muted
      }
    }
  `);
</script>

<div class={flex({ direction: 'column', grow: '1', marginY: '28px', width: 'full', maxWidth: '800px' })}>
  <div
    class={css({
      borderTopRadius: '12px',
      paddingX: '24px',
      paddingTop: '16px',
      paddingBottom: '40px',
      backgroundColor: 'gray.600',
    })}
  >
    <div class={flex({ marginBottom: '10px', fontSize: '13px', fontWeight: 'medium', color: 'gray.400' })}>
      <!-- {#each $query.tag.parents as parent (parent.id)}
        <span class={css({ _after: { content: '|', marginX: '8px' } })}>{parent.name}</span>
      {/each} -->
    </div>

    <div class={flex({ justify: 'space-between', align: 'flex-start' })}>
      <div>
        <h1 class={css({ fontSize: '24px', fontWeight: 'bold', color: 'gray.5' })}>#{$query.tag.name}</h1>
      </div>
      <div class={flex({ align: 'center', gap: '8px' })}>
        {#if $query.tag.followed}
          <Button
            color="secondary"
            size="lg"
            on:click={async () => {
              await unfollowTag({ tagId: $query.tag.id });
              mixpanel.track('tag:unfollow', { tagId: $query.tag.id, via: 'tag' });
              toast.success('관심 태그 해제되었어요');
            }}
          >
            관심 해제
          </Button>
        {:else}
          <Button
            size="lg"
            on:click={async () => {
              if (!$query.me) {
                loginRequireOpen = true;
                return;
              }

              await followTag({ tagId: $query.tag.id });
              mixpanel.track('tag:follow', { tagId: $query.tag.id, via: 'tag' });
              toast.success('관심 태그에 추가했어요');
            }}
          >
            + 관심
          </Button>
        {/if}

        <Menu as="div" placement="bottom-start">
          <button slot="value" class={center()} type="button">
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconDotsVertical} size={24} />
          </button>

          {#if $query.tag.muted}
            <MenuItem
              on:click={async () => {
                await unmuteTag({ tagId: $query.tag.id });
                mixpanel.track('tag:unmute', { tagId: $query.tag.id, via: 'tag' });
                toast.success('태그 숨기기 해제되었어요');
              }}
            >
              태그 안보기 해제
            </MenuItem>
          {:else}
            <MenuItem
              on:click={async () => {
                if (!$query.me) {
                  loginRequireOpen = true;
                  return;
                }

                await muteTag({ tagId: $query.tag.id });
                mixpanel.track('tag:mute', { tagId: $query.tag.id, via: 'tag' });
                toast.success('태그를 숨겼어요');
              }}
            >
              태그 안보기
            </MenuItem>
          {/if}
          <MenuItem>태그 신고</MenuItem>
        </Menu>
      </div>
    </div>
  </div>

  <div
    class={flex({
      direction: 'column',
      gap: '16px',
      grow: '1',
      borderRadius: '12px',
      marginTop: '-12px',
      paddingX: '24px',
      paddingY: '16px',
      backgroundColor: 'gray.5',
    })}
  >
    <TabHead style={css.raw({ width: 'full' })} variant="secondary">
      <TabHeadItem id={1} pathname={`/tag/${$page.params.name}`}>위키</TabHeadItem>
      <TabHeadItem id={2} pathname={`/tag/${$page.params.name}/post`}>포스트</TabHeadItem>
      <!-- <TabHeadItem id={3}>스페이스</TabHeadItem> -->
    </TabHead>

    <slot />
  </div>
</div>

<LoginRequireModal bind:open={loginRequireOpen} />
