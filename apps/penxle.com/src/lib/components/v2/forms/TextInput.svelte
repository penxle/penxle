<script lang="ts">
  import { getFormContext } from '$lib/form';
  import { css, cx, sva } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { RecipeVariant, RecipeVariantProps, SystemStyleObject } from '$styled-system/types';

  export let name: HTMLInputAttributes['name'] = undefined;
  export let value: HTMLInputAttributes['value'] = undefined;
  export let style: SystemStyleObject | undefined = undefined;
  export let size: Variants['size'] = 'md';

  type $$Props = RecipeVariantProps<typeof recipe> &
    Omit<HTMLInputAttributes, 'class' | 'style'> & { style?: SystemStyleObject };
  type $$Events = {
    input: Event & { currentTarget: HTMLInputElement };
    keydown: KeyboardEvent & { currentTarget: HTMLInputElement };
  };

  const { field } = getFormContext();

  if (field) {
    name = field.name;
  }

  type Variants = RecipeVariant<typeof recipe>;
  const recipe = sva({
    className: 'input',
    slots: ['leftIcon', 'root', 'rightIcon'],
    base: {
      leftIcon: { position: 'absolute', insetY: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      root: {
        borderWidth: '1px',
        borderColor: { base: 'gray.50', _enabled: { _hover: 'gray.100', _focus: 'gray.400' } },
        fontSize: '16px',
        fontWeight: 'medium',
        width: 'full',
        backgroundColor: { base: 'gray.50', _enabled: { _hover: 'gray.100', _focus: 'gray.5' }, _disabled: 'gray.100' },
        transition: 'common',
        _disabled: {
          color: 'gray.400',
          _placeholder: { color: 'gray.400' },
        },
        _invalid: {
          borderColor: '[red.600!]',
          color: 'red.600',
          _placeholder: { color: 'red.600' },
        },
      },
      rightIcon: { position: 'absolute', insetY: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    },
    variants: {
      size: {
        xs: {
          leftIcon: { left: '12px' },
          root: {
            paddingX: '12px',
            paddingY: '8px',
            fontSize: '14px',
            height: '34px',
          },
          rightIcon: { right: '12px' },
        },
        sm: {
          leftIcon: { left: '12px' },
          root: {
            paddingX: '12px',
            paddingY: '10px',
            height: '44px',
          },
          rightIcon: { right: '12px' },
        },
        md: {
          leftIcon: { left: '14px' },
          root: {
            padding: '14px',
            height: '48px',
          },
          rightIcon: { right: '14px' },
        },
        lg: {
          leftIcon: { left: '14px' },
          root: {
            padding: '14px',
            height: '52px',
          },
          rightIcon: { right: '14px' },
        },
      },
    },
  });

  $: classes = recipe({ size });
</script>

<div class={flex({ align: 'center', position: 'relative' })}>
  {#if 'left-icon' in $$slots}
    <div class={classes.leftIcon}>
      <slot name="left-icon" />
    </div>
  {/if}
  <input
    id={name}
    {name}
    class={cx(
      classes.root,
      css(
        style,
        'left-icon' in $$slots && {
          paddingLeft: size === 'xs' ? '32px' : size === 'lg' ? '40px' : '34px',
        },
        'right-icon' in $$slots && {
          paddingRight: size === 'xs' ? '32px' : size === 'lg' ? '40px' : '34px',
        },
      ),
    )}
    type="text"
    on:input
    on:keydown
    bind:value
    {...$$restProps}
  />
  {#if 'right-icon' in $$slots}
    <div class={classes.rightIcon}>
      <slot name="right-icon" />
    </div>
  {/if}
</div>
