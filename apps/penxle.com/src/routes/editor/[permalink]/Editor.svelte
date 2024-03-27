<script lang="ts">
  import * as R from 'radash';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { browser, dev } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Helmet } from '$lib/components';
  import { toast } from '$lib/notification';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import Content from './Content.svelte';
  import { setEditorContext } from './context';
  import Header from './Header.svelte';
  import type { EditorPage_Editor_post, EditorPage_Editor_query, PostRevisionKind } from '$glitch';
  import type { EditorState, EditorStore } from './context';

  export { _post as $post, _query as $query };
  let _query: EditorPage_Editor_query;
  let _post: EditorPage_Editor_post;

  $: query = fragment(
    _query,
    graphql(`
      fragment EditorPage_Editor_query on Query {
        ...EditorPage_Header_query
      }
    `),
  );

  $: post = fragment(
    _post,
    graphql(`
      fragment EditorPage_Editor_post on Post {
        id
        ...EditorPage_Header_post

        draftRevision {
          id
          title
          subtitle
          editableContent
          paragraphIndent
          paragraphSpacing
        }
      }
    `),
  );

  const revisePost = graphql(`
    mutation EditorPage_Editor_RevisePost_Mutation($input: RevisePostInput!) {
      revisePost(input: $input) {
        id

        draftRevision {
          id
          kind
          updatedAt
        }
      }
    }
  `);

  let warnUnload = false;

  const store = writable<EditorStore>();
  const state = writable<EditorState>({
    canRevise: true,
    isRevising: false,
  });

  $: if (!$store) {
    $store = {
      title: $post.draftRevision.title ?? undefined,
      subtitle: $post.draftRevision.subtitle ?? undefined,
      content: $post.draftRevision.editableContent,
      paragraphIndent: $post.draftRevision.paragraphIndent,
      paragraphSpacing: $post.draftRevision.paragraphSpacing,
    };
  }

  $: if (browser && $store) {
    warnUnload = true;
    autoSave();
  }

  $: $state.isRevising = $revisePost.inflight;

  const makeRevisePost = (revisionKind: PostRevisionKind) => {
    return async () => {
      try {
        const resp = await revisePost({
          revisionKind,
          postId: $post.id,
          title: $store.title,
          subtitle: $store.subtitle,
          content: $store.content,
          paragraphIndent: $store.paragraphIndent,
          paragraphSpacing: $store.paragraphSpacing,
        });

        mixpanel.track('post:revise', { postId: $post.id, revisionKind });

        $state.lastRevision = {
          kind: resp.draftRevision.kind,
          updatedAt: resp.draftRevision.updatedAt,
        };

        warnUnload = false;

        return resp.draftRevision.id;
      } catch (err) {
        toast.error('포스트를 저장하는 중에 문제가 발생했어요');
        throw err;
      }
    };
  };

  const autoSave = R.debounce({ delay: 1000 }, makeRevisePost('AUTO_SAVE'));

  beforeNavigate(({ cancel, willUnload }) => {
    if (dev || !warnUnload) {
      return;
    }

    if (willUnload) {
      cancel();
    } else if (!confirm('작성 중인 포스트가 있어요. 정말 나가시겠어요?')) {
      cancel();
    }
  });

  setEditorContext({
    store,
    state,
    forceSave: makeRevisePost('MANUAL_SAVE'),
  });

  let vvHeight: number | undefined;

  const handleVisualViewportChange = () => {
    if (window.visualViewport) {
      vvHeight = window.visualViewport.height + window.visualViewport.offsetTop;
    }
  };

  onMount(() => {
    handleVisualViewportChange();

    window.visualViewport?.addEventListener('resize', handleVisualViewportChange);
    window.visualViewport?.addEventListener('scroll', handleVisualViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange);
    };
  });
</script>

<Helmet description="포스트 작성하기" title={`${$store.title ?? '(제목 없음)'} 작성`} />

<div
  class={css({ position: 'relative', flexGrow: '1', isolation: 'isolate', userSelect: 'none', touchAction: 'none' })}
>
  <div style:height={vvHeight ? `${vvHeight}px` : '100dvh'} class={flex({ direction: 'column' })}>
    <Header {$post} {$query} />

    <div class={flex({ direction: 'column', grow: '1', marginTop: '112px', overflow: 'auto' })}>
      <Content />
    </div>
  </div>
</div>
