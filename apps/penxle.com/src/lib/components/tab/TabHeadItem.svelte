<script lang="ts">
  import { getContext } from 'svelte';
  import { page } from '$app/stores';
  import { css } from '$styled-system/css';
  import type { Writable } from 'svelte/store';
  import type { SystemStyleObject } from '$styled-system/types';

  export let id: number;
  export let activeTabValue: number | undefined = undefined;
  export let pathname: string | undefined = undefined;

  export let style: SystemStyleObject | undefined = undefined;

  let search = getContext<Writable<string | undefined>>('search');

  let element: 'a' | 'button';
  $: element = pathname ? 'a' : 'button';
  $: props = element === 'a' ? { href: pathname && pathname + ($search ?? '') } : { type: 'button' };

  $: pathnameRegex = pathname ? new RegExp(`^${pathname}/?$`) : null;
  $: selected = activeTabValue === id || pathnameRegex?.test($page.url.pathname);
</script>

<li class={css({ smDown: { flexGrow: '1' } })} role="presentation">
  <svelte:element
    this={element}
    id="{id}-tabhead"
    class={css(
      {
        display: 'block',
        flexGrow: { base: '1', sm: '0' },
        width: 'full',
        color: { base: 'gray.400', _hover: 'gray.900', _selected: 'gray.900' },
        transition: 'common',
        borderBottomWidth: '2px',
        borderBottomColor: { base: 'transparent', _hover: 'gray.900', _selected: 'gray.900' },
        paddingBottom: '2px',
        textAlign: 'center',
        fontWeight: 'bold',
        backgroundColor: { base: 'gray.5', sm: 'transparent' },
      },
      style,
    )}
    aria-selected={selected}
    role="tab"
    tabindex="-1"
    on:click
    {...props}
  >
    <slot />
  </svelte:element>
</li>
