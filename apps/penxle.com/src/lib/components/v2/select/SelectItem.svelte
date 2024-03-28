<script lang="ts">
  import { getContext } from 'svelte';
  import IconCheck from '~icons/tabler/check';
  import { Icon } from '$lib/components';
  import { css, cva } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { RecipeVariant } from '$styled-system/css';

  let close = getContext<undefined | (() => void)>('close');
  let size = getContext<Variants['size']>('size');

  export let pressed = false;
  export let state: Variants['state'] = 'default';

  type Variants = RecipeVariant<typeof recipe>;
  const recipe = cva({
    base: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingX: '14px',
      // fontWeight: { _pressed: 'semibold'},
      color: { base: 'gray.600', _hover: 'gray.900', _focus: 'gray.900', _pressed: 'gray.900' },
      textAlign: 'left',
      width: 'full',
      backgroundColor: { _hover: 'gray.100', _focus: 'gray.100' },
      transition: 'common',
    },
    variants: {
      state: {
        default: {},
        create: {
          borderTopWidth: '1px',
          borderTopColor: 'gray.200',
          fontSize: '13px',
          backgroundColor: { base: 'gray.50', _hover: 'gray.100' },
        },
      },
      size: {
        xs: { paddingY: '8px', fontSize: '13px' },
        sm: { paddingY: '12px', fontSize: '14px' },
        md: { paddingY: '14px', fontSize: '14px' },
        lg: { paddingY: '14px', fontSize: '16px' },
      },
    },
  });
</script>

<li>
  <button
    class={css(recipe.raw({ size, state }))}
    aria-pressed={pressed}
    tabIndex={0}
    type="button"
    on:click
    on:click={close}
  >
    <div class={flex({ align: 'center', justify: 'space-between', gap: '4px', flexGrow: '1', truncate: true })}>
      <slot />

      {#if pressed}
        <Icon style={css.raw({ 'color': 'cyan.400', '& *': { strokeWidth: '[2]' } })} icon={IconCheck} />
      {/if}
    </div>
  </button>
</li>
