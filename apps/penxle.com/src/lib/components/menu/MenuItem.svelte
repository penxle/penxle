<script generics="T extends 'button' | 'div' | 'link' = 'button'" lang="ts">
  import { getContext } from 'svelte';
  import { css } from '$styled-system/css';
  import type { SystemStyleObject } from '$styled-system/types';

  type $$Props = {
    type?: T;
    style?: SystemStyleObject;
    disabled?: boolean;
  } & (T extends 'link' ? { href: string; external?: boolean } : unknown) &
    (T extends 'button' ? { 'aria-pressed'?: boolean } : unknown);

  type $$Events = T extends 'link' ? unknown : { click: MouseEvent };

  export let type: 'button' | 'div' | 'link' = 'button';

  export let style: SystemStyleObject | undefined = undefined;

  export let disabled = false;
  export let href: string | undefined = undefined;
  export let external = !href?.startsWith('/');

  let element: 'a' | 'button' | 'div';
  $: element = type === 'link' ? 'a' : type;
  $: props =
    (type === 'link' && { href: disabled || href }) || (type === 'button' && { type: 'button', disabled }) || {};

  let close = getContext<undefined | (() => void)>('close');
</script>

<svelte:element
  this={element}
  class={css(
    { borderRadius: '8px', paddingX: '14px', paddingY: '12px', width: 'full', fontSize: '14px' },
    disabled ? { cursor: 'not-allowed' } : { _hover: { backgroundColor: 'teal.50', color: 'teal.600' } },
    style,
  )}
  role="menuitem"
  tabindex="-1"
  on:click
  on:click={close}
  {...external && {
    target: '_blank',
    rel: 'noopener noreferrer',
  }}
  {...props}
>
  <slot />
</svelte:element>
