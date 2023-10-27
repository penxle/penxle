<script lang="ts">
  import { Editor } from '@tiptap/core';
  import { clsx } from 'clsx';
  import { onMount } from 'svelte';
  import { extensions } from '$lib/tiptap';
  import type { JSONContent } from '@tiptap/core';

  let _class: string;
  export { _class as class };
  export let editor: Editor | undefined;
  export let content: JSONContent | undefined = undefined;

  let element: HTMLDivElement;

  onMount(() => {
    editor = new Editor({
      element,
      content,
      extensions,
      injectCSS: false,
      editorProps: {
        attributes: { class: _class },
        scrollMargin: { top: 100, bottom: 100, left: 0, right: 0 },
        scrollThreshold: { top: 100, bottom: 100, left: 0, right: 0 },
        handleKeyDown: (_, event) => {
          // 맥 구름입력기에서 엔터키 입력시 마지막 글자 잘리는 문제 workaround
          if (editor && event.key === 'Enter') {
            const s = editor.view.state.selection;
            editor.commands.setTextSelection(s.to);
          }
        },
      },
      onTransaction: () => {
        editor = editor;
        content = editor?.getJSON();
      },
    });

    return () => {
      editor?.destroy();
    };
  });
</script>

<div bind:this={element} class="contents">
  {#if !editor}
    <div class={clsx('ProseMirror', _class)}>
      <p class="is-editor-empty" data-placeholder="내용을 입력하세요" />
    </div>
  {/if}
</div>