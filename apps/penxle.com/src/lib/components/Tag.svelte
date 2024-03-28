<script lang="ts">
  import { css, cva } from '$styled-system/css';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { SystemStyleObject } from '$styled-system/types';

  export let size: 'sm' | 'lg' = 'lg';
  export let style: SystemStyleObject | undefined = undefined;

  export let as: 'div' | 'a' | 'label' = 'a';
  export let checked = false;
  export let name: string | undefined = undefined;

  type $$Events = {
    change: Parameters<NonNullable<HTMLInputAttributes['on:change']>>[0];
  };

  const recipe = cva({
    base: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'gray.100',
      height: 'fit',
      transition: 'common',
      truncate: true,
      cursor: 'pointer',
    },
    variants: {
      size: {
        sm: {
          'paddingX': '6px',
          'paddingY': '2px',
          'fontSize': '11px',
          'color': 'gray.500',
          'backgroundColor': { base: 'gray.50', _hover: 'gray.150' },
          '&:has(:checked)': {
            borderWidth: '1px',
            borderColor: 'gray.300',
          },
        },
        lg: {
          'paddingX': '14px',
          'paddingY': '6px',
          'fontSize': '13px',
          'fontWeight': 'medium',
          'color': 'gray.5',
          'backgroundColor': { base: 'gray.900', _hover: 'gray.400' },
          '&:has(:checked)': {
            borderWidth: '1px',
            borderColor: 'gray.400',
          },
        },
      },
    },
  });
</script>

<svelte:element
  this={as}
  id={name}
  class={css(
    recipe.raw({ size }),
    'right-icon' in $$slots && {
      gap: '4px',
      paddingLeft: size === 'sm' ? '6px' : '10px',
      paddingRight: size === 'sm' ? '4px' : '8px',
    },
    style,
  )}
  {...$$restProps}
>
  {#if as === 'label'}
    <input class={css({ appearance: 'none' })} aria-checked={checked} type="checkbox" on:change bind:checked />
  {/if}

  <slot />

  {#if 'right-icon' in $$slots}
    <slot name="right-icon" />
  {/if}
</svelte:element>
