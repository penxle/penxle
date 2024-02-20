<script lang="ts">
  import clsx from 'clsx';
  import IsomorphicImage from './IsomorphicImage.svelte';
  import Slide from './Slide.svelte';
  import type { NodeViewProps } from '$lib/tiptap';

  export let node: NodeViewProps['node'];
  export let updateAttributes: NodeViewProps['updateAttributes'];

  export let deletable = false;
  let _class: string | undefined = undefined;
  export { _class as class };

  const removeImage = async (id: string) => {
    await updateAttributes((attrs) => ({
      __data: attrs.__data.filter((i: IsomorphicImage) => i.id !== id),
    }));
  };
</script>

<div
  class={clsx(
    node.attrs.size === 'full' && 'max-w-full',
    node.attrs.size === 'compact' && 'max-w-500px',
    node.attrs.layout === 'standalone' && 'gap-6',
    node.attrs.layout !== 'grid' && 'flex flex-col items-center',
    node.attrs.layout === 'grid' && 'grid',
    node.attrs.layout === 'grid' && node.attrs.gridColumns === 2 && 'grid-cols-2',
    node.attrs.layout === 'grid' && node.attrs.gridColumns === 3 && 'grid-cols-3',
    node.attrs.spacing && 'gap-1.5',
    _class,
  )}
>
  {#if node.attrs.layout === 'slide'}
    <Slide isomorphicImages={node.attrs.__data} slidesPerPage={node.attrs.slidesPerPage} spacing={node.attrs.spacing} />
  {:else}
    {#each node.attrs.__data as image (image.id)}
      <div class="relative square-full">
        <IsomorphicImage class="square-full object-cover" {image} />
        {#if deletable}
          <button
            class="square-6.5 bg-#09090B66 rounded-sm flex center absolute bottom-3.5 right-3.5"
            type="button"
            on:click={() => removeImage(image.id)}
          >
            <i class="i-tb-trash square-4.5 text-white" />
          </button>
        {/if}
      </div>
    {/each}
  {/if}
</div>
