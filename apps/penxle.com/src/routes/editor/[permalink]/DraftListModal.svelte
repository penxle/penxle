<script lang="ts">
  import dayjs from 'dayjs';
  import IconCalendar from '~icons/tabler/calendar';
  import IconTextRecognition from '~icons/tabler/text-recognition';
  import IconTrash from '~icons/tabler/trash';
  import { goto } from '$app/navigation';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Chip, Icon, Modal } from '$lib/components';
  import { toast } from '$lib/notification';
  import { css, cx } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { EditorPage_DraftListModal_post, EditorPage_DraftListModal_user } from '$glitch';

  let _user: EditorPage_DraftListModal_user;
  let _post: EditorPage_DraftListModal_post;
  export { _post as $post, _user as $user };
  export let open = false;

  let deletePostId: string | undefined;
  let deletePostOpen = false;

  $: user = fragment(
    _user,
    graphql(`
      fragment EditorPage_DraftListModal_user on User {
        id

        posts(state: DRAFT) {
          id
          permalink

          draftRevision {
            id
            title
            characterCount
            updatedAt
          }
        }
      }
    `),
  );

  $: post = fragment(
    _post,
    graphql(`
      fragment EditorPage_DraftListModal_post on Post {
        id
      }
    `),
  );

  const deletePost = graphql(`
    mutation EditorPage_DraftListModal_DeletePost_Mutation($input: DeletePostInput!) {
      deletePost(input: $input) {
        id
      }
    }
  `);
</script>

<Modal bind:open>
  <svelte:fragment slot="title">임시저장된 포스트</svelte:fragment>
  <svelte:fragment slot="subtitle">{$user.posts?.length ?? 0}개의 포스트</svelte:fragment>

  <ul class={css({ sm: { maxHeight: '240px', overflowY: 'auto' } })}>
    {#each $user.posts as _post (_post.id)}
      <li
        class={cx(
          'group',
          flex({
            justify: 'space-between',
            align: 'center',
            gap: '8px',
            borderTopWidth: '1px',
            borderTopColor: 'gray.200',
            paddingY: '12px',
          }),
        )}
      >
        <button
          class={css({ width: 'full', truncate: true })}
          type="button"
          on:click={async () => {
            open = false;
            await goto(`/editor/${_post.permalink}`);
          }}
        >
          <p
            class={css(
              { marginBottom: '4px', textAlign: 'left', fontWeight: 'bold', truncate: true },
              _post.draftRevision?.title?.trim().length === 0 && { color: 'gray.500' },
            )}
          >
            {_post.draftRevision?.title?.trim().length === 0
              ? '(제목 없음)'
              : _post.draftRevision?.title ?? '(제목 없음)'}
          </p>
          <div class={flex({ align: 'center', gap: '8px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
            <div class={flex({ align: 'center', gap: '2px' })}>
              <Icon icon={IconCalendar} />
              {dayjs(_post.draftRevision?.updatedAt).formatAsDateTime()}
            </div>

            <div class={flex({ align: 'center', gap: '2px' })}>
              <Icon icon={IconTextRecognition} />
              {_post.draftRevision.characterCount}자
            </div>
          </div>
        </button>
        <button
          class={css({ display: 'none', _groupHover: { display: 'block' } })}
          type="button"
          on:click={() => {
            deletePostOpen = true;
            deletePostId = _post.id;
          }}
        >
          <Icon style={css.raw({ color: 'gray.400' })} icon={IconTrash} size={20} />
        </button>
        {#if _post.id === $post.id}
          <div class={css({ flex: 'none', marginBottom: '4px' })}>
            <Chip color="grass">현재 포스트</Chip>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</Modal>

<Modal size="sm" bind:open={deletePostOpen}>
  <svelte:fragment slot="title">임시저장글을 삭제할까요?</svelte:fragment>

  <div slot="action" class={flex({ gap: '12px', width: 'full' })}>
    <Button style={css.raw({ width: 'full' })} color="secondary" size="xl" on:click={() => (deletePostOpen = false)}>
      닫기
    </Button>
    <Button
      style={css.raw({ width: 'full' })}
      size="xl"
      on:click={async () => {
        if (deletePostId) {
          await deletePost({ postId: deletePostId });
          mixpanel.track('post:delete', { postId: deletePostId, via: 'editor' });
          toast.success('임시저장 포스트를 삭제했어요');
          deletePostOpen = false;

          if (deletePostId === $post.id) {
            await goto('/');
          }
        }
      }}
    >
      삭제
    </Button>
  </div>
</Modal>
