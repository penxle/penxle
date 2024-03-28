<script lang="ts">
  import dayjs from 'dayjs';
  import qs from 'query-string';
  import IconDots from '~icons/tabler/dots';
  import { fragment, graphql } from '$glitch';
  import { Chip, Icon, Modal } from '$lib/components';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import { getEditorContext } from './context';
  import type { EditorPage_RevisionListModal_Post } from '$glitch';

  let _post: EditorPage_RevisionListModal_Post;
  export let open: boolean;
  export { _post as $post };

  const { store, forceSave } = getEditorContext();

  $: post = fragment(
    _post,
    graphql(`
      fragment EditorPage_RevisionListModal_Post on Post {
        id
        permalink

        revisions {
          id
          kind
          createdAt
        }
      }
    `),
  );

  $: restoreRevision = graphql(`
    query EditorPage_RevisionListModal_RestoreRevision($permalink: String!, $revisionId: ID) @_manual {
      post(permalink: $permalink) {
        id

        draftRevision(revisionId: $revisionId) @_required {
          id
          kind
          content
          title
          subtitle
          paragraphIndent
          paragraphSpacing
        }
      }
    }
  `);

  let selectedRevisionId: string;

  $: selectedRevisionId = $post.revisions[0].id;
  $: disabled = $post.revisions.length === 1;

  $: previewSource = `/editor/${$post.permalink}/preview`;
</script>

<Modal size="lg" bind:open>
  <svelte:fragment slot="title">저장 이력</svelte:fragment>

  <article class={flex({ gap: '12px', height: '512px' })}>
    <iframe
      class={css({ width: '458px' })}
      src={qs.stringifyUrl({
        url: previewSource,
        query: {
          revisionId: selectedRevisionId,
          hideHeader: true,
        },
      })}
      title="미리보기"
    />
    <aside class={css({ flexGrow: '1' })}>
      <ul class={css({ size: 'full', overflowY: 'auto' })}>
        {#each $post.revisions as revision (revision.id)}
          <li
            class={css(
              {
                'display': 'flex',
                'justifyContent': 'space-between',
                'alignItems': 'center',
                'borderRadius': '4px',
                'paddingX': '8px',
                'paddingY': '12px',
                'width': 'full',
                '_hover': { backgroundColor: 'gray.50' },
                '--menu-display': 'none',
              },
              selectedRevisionId === revision.id && {
                'backgroundColor': 'gray.50',
                '--menu-display': 'block',
              },
            )}
          >
            <button
              class={css({ flexGrow: '1' })}
              aria-pressed={selectedRevisionId === revision.id}
              type="button"
              on:click={() => {
                selectedRevisionId = revision.id;
              }}
            >
              <dl>
                <dt class={flex({ gap: '4px', fontWeight: 'bold' })}>
                  <time datetime={revision.createdAt.slice(0, 11)}>{dayjs(revision.createdAt).formatAsDate()}</time>
                  {#if revision.kind === 'PUBLISHED' || revision.kind === 'ARCHIVED'}
                    <Chip color="grass">발행</Chip>
                  {/if}
                </dt>
                <dd class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500', textAlign: 'left' })}>
                  <time datetime={revision.createdAt.slice(12)}>
                    {dayjs(revision.createdAt).format('HH:mm:ss')}
                  </time>
                </dd>
              </dl>
            </button>
            <Menu
              style={css.raw({
                display: '[var(--menu-display)]',
                padding: '8px',
                color: { base: 'gray.500', _hover: 'gray.900' },
              })}
              {disabled}
              placement="right-start"
            >
              <Icon slot="value" icon={IconDots} size={24} />
              <MenuItem
                on:click={async () => {
                  const fetched = await restoreRevision.refetch({
                    permalink: $post.permalink,
                    revisionId: revision.id,
                  });

                  $store.title = fetched.post.draftRevision.title ?? undefined;
                  $store.subtitle = fetched.post.draftRevision.subtitle ?? undefined;
                  $store.content = fetched.post.draftRevision.content;
                  $store.paragraphIndent = fetched.post.draftRevision.paragraphIndent;
                  $store.paragraphSpacing = fetched.post.draftRevision.paragraphSpacing;

                  await forceSave();
                  location.reload();
                }}
              >
                복원하기
              </MenuItem>
              <MenuItem
                external
                href={qs.stringifyUrl({
                  url: previewSource,
                  query: {
                    revisionId: selectedRevisionId,
                  },
                })}
                type="link"
              >
                새 창으로 보기
              </MenuItem>
            </Menu>
          </li>
          <hr class={css({ borderColor: 'gray.200', marginY: '12px', _last: { display: 'none' } })} />
        {/each}
      </ul>
    </aside>
  </article>
</Modal>
