<script lang="ts">
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Image, Modal } from '$lib/components';
  import { PopupSearch } from '$lib/components/forms';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { MeSettingsContentFiltersPage_MutedSpaceModal_user } from '$glitch';

  let _user: MeSettingsContentFiltersPage_MutedSpaceModal_user;
  export { _user as $user };
  export let open = false;

  let mutedSpaces: typeof $user.mutedSpaces | undefined;
  let query = '';

  const setSpaces = () => {
    mutedSpaces = $user.mutedSpaces;
  };

  $: if (open) {
    setSpaces();
  }

  $: user = fragment(
    _user,
    graphql(`
      fragment MeSettingsContentFiltersPage_MutedSpaceModal_user on User {
        id

        mutedSpaces {
          id
          name
          description
          muted

          icon {
            id
            ...Image_image
          }
        }
      }
    `),
  );

  const muteSpace = graphql(`
    mutation MeSettingsContentFiltersPage_MuteSpace_Mutation($input: MuteSpaceInput!) {
      muteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  const unmuteSpace = graphql(`
    mutation MeSettingsContentFiltersPage_UnmuteSpace_Mutation($input: UnmuteSpaceInput!) {
      unmuteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  $: filteredSpaces = mutedSpaces?.filter((space) => space.name.includes(query));
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">숨긴 스페이스</svelte:fragment>

  <PopupSearch
    style={css.raw({ marginBottom: '16px' }, mutedSpaces?.length === 0 && { display: 'none' })}
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
        <div class={flex({ align: 'center', gap: '8px', marginRight: '8px', truncate: true })}>
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
            <p class={css({ flexGrow: '1', fontSize: '15px', fontWeight: 'bold', truncate: true })}>{space.name}</p>
            <p class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500', truncate: true })}>
              {space.description ?? ''}
            </p>
          </div>
        </div>
        {#if $user.mutedSpaces.find((muted) => muted.id === space.id)}
          <Button
            style={css.raw({ flexShrink: '0' })}
            color="tertiary"
            size="md"
            variant="outlined"
            on:click={async () => {
              await unmuteSpace({ spaceId: space.id });
              mixpanel.track('space:unmute', { spaceId: space.id, via: 'content-filters' });
            }}
          >
            해제
          </Button>
        {:else}
          <Button
            style={css.raw({ flexShrink: '0' })}
            color="secondary"
            size="md"
            on:click={async () => {
              await muteSpace({ spaceId: space.id });
              mixpanel.track('space:mute', { spaceId: space.id, via: 'content-filters' });
            }}
          >
            등록
          </Button>
        {/if}
      </li>
    {:else}
      <article class={css({ fontWeight: 'medium', color: 'gray.500', textAlign: 'center', wordBreak: 'keep-all' })}>
        {#if mutedSpaces}
          {mutedSpaces.length === 0 ? '숨긴 스페이스가 없어요' : '일치하는 검색 결과가 없어요'}
        {/if}
      </article>
    {/each}
  </ul>
</Modal>
