<script lang="ts">
  import { flex } from '$styled-system/patterns';
  import Item from './Item.svelte';
  import { store } from './store';
</script>

<div
  class={flex({
    align: 'center',
    position: 'fixed',
    top: '74px',
    left: '1/2',
    translate: 'auto',
    translateX: '-1/2',
    direction: 'column',
    gap: '8px',
    width: 'screen',
    zIndex: '100',
    pointerEvents: 'none',
  })}
>
  {#each $store as toast (toast.id)}
    <Item {toast} />
  {/each}
</div>
