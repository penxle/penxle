<script lang="ts">
  import { setContext } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { createFloatingActions, portal } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';
  import type { Placement } from '@floating-ui/dom';
  import type { SystemStyleObject } from '$styled-system/types';

  export let open = false;
  export let offset: number | undefined = undefined;
  export let padding = true;

  export let style: SystemStyleObject | undefined = undefined;
  export let menuStyle: SystemStyleObject | undefined = undefined;

  export let as: 'button' | 'div' = 'button';

  export let placement: Placement = 'bottom-end';

  export let alignment: 'horizontal' | 'vertical' = 'vertical';

  export let preventClose = false;
  export let disabled = false;

  export let rounded = true;

  $: props = as === 'button' ? { type: 'button', disabled } : { tabindex: -1 };

  setContext('close', preventClose ? undefined : () => (open = false));

  const { anchor, floating } = createFloatingActions({
    placement,
    offset: offset ?? 4,
  });

  afterNavigate(() => {
    open = false;
  });

  function toggleOpen() {
    open = !open;
  }
</script>

<svelte:element
  this={as}
  class={css(style)}
  role="button"
  tabindex="-1"
  on:click={toggleOpen}
  on:keypress={as === 'div' ? toggleOpen : null}
  use:anchor
  {...props}
>
  <slot name="value" {open} />
</svelte:element>

{#if open}
  <div
    class={css({ position: 'fixed', inset: '0', zIndex: '40' })}
    role="button"
    tabindex="-1"
    on:click={() => (open = false)}
    on:keypress={null}
    use:portal
  />

  <div
    class={css(
      {
        display: 'flex',
        gap: '4px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '8px',
        paddingX: '10px',
        boxShadow: '[0 5px 22px 0 {colors.gray.900/6}]',
        backgroundColor: 'gray.5',
        zIndex: '50',
      },
      alignment === 'horizontal' && { flexDirection: 'row', paddingY: '4px' },
      alignment === 'vertical' && { flexDirection: 'column', paddingY: '10px' },
      !padding && { padding: '0' },
      !rounded && { borderTopRadius: '0' },
      menuStyle,
    )}
    use:floating
  >
    <slot />
  </div>
{/if}
