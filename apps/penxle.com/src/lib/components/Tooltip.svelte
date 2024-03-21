<script lang="ts">
  import { writable } from 'svelte/store';
  import { scale } from 'svelte/transition';
  import { createFloatingActions, hover } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';
  import type { Placement } from '@floating-ui/dom';
  import type { SystemStyleObject } from '$styled-system/types';

  export let style: SystemStyleObject | undefined = undefined;
  export let offset: number | undefined = undefined;

  export let enabled = true;
  export let message: string | undefined = undefined;
  export let placement: Placement = 'bottom';
  export let keepShowing = false;

  const hovered = writable(false);

  const { anchor, floating, arrow } = createFloatingActions({
    placement,
    offset: offset ?? 0,
    arrow: true,
  });
</script>

<div class={css(style)} use:anchor use:hover={hovered}>
  <slot />
</div>

{#if enabled && ($hovered || keepShowing)}
  <div
    class={css({
      borderWidth: '1px',
      borderColor: 'gray.300',
      paddingX: '14px',
      paddingY: '10px',
      fontSize: '12px',
      backgroundColor: 'gray.5',
      zIndex: '100',
      maxWidth: '230px',
    })}
    role="tooltip"
    use:floating
    transition:scale={{ start: 0.9, duration: 200 }}
  >
    <slot name="message">
      {message}
    </slot>
    <div
      class={css({
        borderTopWidth: '1px',
        borderLeftWidth: '1px',
        borderColor: 'gray.300',
        size: '8px',
        backgroundColor: 'gray.5',
      })}
      use:arrow
    />
  </div>
{/if}
