<script lang="ts">
  import { setContext } from 'svelte';
  import { slide } from 'svelte/transition';
  import IconCaretDownFilled from '~icons/tabler/caret-down-filled';
  import IconCaretUpFilled from '~icons/tabler/caret-up-filled';
  import { Icon } from '$lib/components';
  import { css, cx, sva } from '$styled-system/css';
  import type { RecipeVariant } from '$styled-system/css';
  import type { SystemStyleObject } from '$styled-system/types';

  export let open = false;
  export let disabled = false;
  export let size: Variants['size'] = 'md';
  export let style: SystemStyleObject | undefined = undefined;
  export let listStyle: SystemStyleObject | undefined = undefined;

  setContext('close', () => (open = false));
  setContext('size', size);

  type Variants = RecipeVariant<typeof recipe>;
  const recipe = sva({
    slots: ['root', 'container', 'list'],
    base: {
      root: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        borderWidth: '1px',
        borderColor: { base: 'gray.150', _enabled: { _hover: 'gray.100', _focus: 'gray.600' } },
        paddingX: '14px',
        fontWeight: 'medium',
        color: 'gray.600',
        width: 'full',
        backgroundColor: { base: 'gray.5', _enabled: { _hover: 'gray.100' }, _disabled: 'gray.50' },
        transition: 'common',
        _disabled: {
          cursor: 'not-allowed',
        },
      },
      container: {
        position: 'absolute',
        left: '0',
        borderWidth: '1px',
        borderColor: { _focusWithin: 'gray.600' },
        borderTopStyle: 'none',
        width: 'full',
        backgroundColor: 'gray.5',
        zIndex: '50',
      },
      list: {
        overflowY: 'auto',
      },
    },
    variants: {
      size: {
        xs: {
          root: { gap: '4px', borderColor: 'gray.100', paddingY: '8px', fontSize: '13px', height: '34px' },
          container: { top: '34px' },
        },
        sm: {
          root: { paddingY: '12px', fontSize: '14px', height: '44px' },
          container: { top: '44px' },
          list: { maxHeight: '153px' },
        },
        md: {
          root: { paddingY: '14px', fontSize: '14px', height: '48px' },
          container: { top: '48px' },
          list: { maxHeight: '167px' },
        },
        lg: {
          root: { paddingY: '14px', fontSize: '16px', height: '52px' },
          container: { top: '52px' },
          list: { maxHeight: '181px' },
        },
      },
    },
  });

  $: classes = recipe({ size });
</script>

<div class={css({ position: 'relative' })}>
  <button
    class={cx(classes.root, css(style))}
    {disabled}
    type="button"
    on:click={() => (open = true)}
    on:focus={() => (open = true)}
  >
    <slot name="placeholder" />

    {#if open}
      <Icon icon={IconCaretUpFilled} />
    {:else}
      <Icon icon={IconCaretDownFilled} />
    {/if}
  </button>

  {#if open}
    <div
      class={css({ position: 'fixed', inset: '0', zIndex: '50' })}
      role="button"
      tabindex="-1"
      on:click={() => (open = false)}
      on:keypress={null}
    />

    <ul class={cx(classes.container, css(listStyle))} transition:slide={{ axis: 'y', duration: 250 }}>
      <li>
        <ul class={classes.list}>
          <slot />
        </ul>
      </li>

      <slot name="create" />
    </ul>
  {/if}
</div>
