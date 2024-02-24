<script lang="ts">
  import clsx from 'clsx';
  import { portal, scrollLock } from '$lib/svelte/actions';
  import { NodeView } from '$lib/tiptap';
  import { TiptapNodeViewBubbleMenu } from '$lib/tiptap/components';
  import Display from './Display.svelte';
  import Editor from './Editor.svelte';
  import type { NodeViewProps } from '$lib/tiptap';

  type $$Props = NodeViewProps;
  $$restProps;

  export let node: NodeViewProps['node'];
  export let editor: NodeViewProps['editor'] | undefined;
  export let selected: NodeViewProps['selected'];
  export let getPos: NodeViewProps['getPos'];
  export let deleteNode: NodeViewProps['deleteNode'];
  export let updateAttributes: NodeViewProps['updateAttributes'];

  let open = node.attrs.layout === 'initial';
  let onClose: (() => void) | null;
  let viewerOpen = false;

  const handleClose = () => {
    if (node.attrs.layout !== 'initial' && node.attrs.__data.length === 0) {
      deleteNode();
      return;
    }

    if (editor && node.attrs.layout === 'standalone' && node.attrs.__data.length > 0) {
      let chain = editor.chain();
      for (const image of node.attrs.__data) {
        chain = chain.setStandaloneGallery(image);
      }
      chain.run();
      deleteNode();
      return;
    }
  };

  $: if (open) {
    onClose = handleClose;
  } else {
    onClose?.();
    onClose = null;
  }
</script>

<NodeView
  class={clsx(
    'flex items-center pointer-events-none py-4px',
    node.attrs.align === 'left' && 'justify-start',
    node.attrs.align === 'center' && 'justify-center',
    node.attrs.align === 'right' && 'justify-end',
  )}
  data-drag-handle
  draggable
>
  <div
    class={clsx(
      'pointer-events-auto min-w-0',
      node.attrs.ids.length === 0 && 'bg-#d9d9d9 w-400px h-200px',
      selected && 'ring-2 ring-teal-500',
    )}
  >
    <div class={clsx(editor?.isEditable && 'pointer-events-none', !editor?.isEditable && 'relative')}>
      <Display {node} {updateAttributes} />
      <button
        class="p-1 bg-gray-950/40 rounded-sm absolute top-3.5 right-3.5 z-2"
        type="button"
        on:click={() => (viewerOpen = true)}
      >
        <i class="i-tb-arrows-maximize text-white square-4.5 block" />
      </button>
    </div>
  </div>
</NodeView>

{#if editor && selected}
  <TiptapNodeViewBubbleMenu {editor} {getPos} {node}>
    <button class="p-4px rounded-2px transition hover:bg-gray-100" type="button" on:click={() => (open = true)}>
      <i class="i-tb-edit text-gray-600 square-18px block <sm:square-20px" />
    </button>

    <div class="w-1px h-12px bg-gray-200" />

    {#if node.attrs.size === 'compact'}
      <button
        class="p-4px rounded-2px transition hover:bg-gray-100"
        type="button"
        on:click={() => {
          updateAttributes({ align: 'left' });
          editor?.commands.focus();
        }}
      >
        <i
          class={clsx(
            'i-tb-align-left text-gray-600 square-18px block <sm:square-20px',
            node.attrs.align === 'left' && 'text-teal-500!',
          )}
        />
      </button>

      <button
        class="p-4px rounded-2px transition hover:bg-gray-100"
        type="button"
        on:click={() => {
          updateAttributes({ align: 'center' });
          editor?.commands.focus();
        }}
      >
        <i
          class={clsx(
            'i-tb-align-center text-gray-600 square-18px block <sm:square-20px',
            node.attrs.align === 'center' && 'text-teal-500!',
          )}
        />
      </button>

      <button
        class="p-4px rounded-2px transition hover:bg-gray-100"
        type="button"
        on:click={() => {
          updateAttributes({ align: 'right' });
          editor?.commands.focus();
        }}
      >
        <i
          class={clsx(
            'i-tb-align-right text-gray-600 square-18px block <sm:square-20px',
            node.attrs.align === 'right' && 'text-teal-500!',
          )}
        />
      </button>

      <div class="w-1px h-12px bg-gray-200" />
    {/if}

    <button
      class="p-4px rounded-2px transition hover:bg-gray-100"
      type="button"
      on:click={() => {
        updateAttributes({ size: 'full' });
        editor?.commands.focus();
      }}
    >
      <i
        class={clsx(
          'i-px2-embed-full text-gray-600 square-18px block <sm:square-20px',
          node.attrs.size === 'full' && 'text-teal-500!',
        )}
      />
    </button>
    <button
      class="p-4px rounded-2px transition hover:bg-gray-100"
      type="button"
      on:click={() => {
        updateAttributes({ size: 'compact' });
        editor?.commands.focus();
      }}
    >
      <i
        class={clsx(
          'i-px2-embed-compact text-gray-600 square-18px block <sm:square-20px',
          node.attrs.size === 'compact' && 'text-teal-500!',
        )}
      />
    </button>

    <div class="w-1px h-12px bg-gray-200" />

    <button class="p-4px rounded-2px transition hover:bg-gray-100" type="button" on:click={() => deleteNode()}>
      <i class="i-tb-trash text-gray-600 square-18px block" />
    </button>
  </TiptapNodeViewBubbleMenu>

  <Editor {node} {updateAttributes} bind:open />
{/if}

{#if viewerOpen}
  <div class="fixed inset-0 z-999 flex center" role="presentation" use:portal use:scrollLock>
    <div class="fixed inset-0 bg-gray-950" />
    <button
      class="i-tb-x square-5 text-white absolute top-6 right-6 z-999 <sm:square-6"
      type="button"
      on:click={() => (viewerOpen = false)}
    />
    <div class="flex center sm:mx-20 overflow-auto">
      <Display class="max-h-full max-w-full overflow-auto" {node} {updateAttributes} />
    </div>
  </div>
{/if}
