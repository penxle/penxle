<script lang="ts">
  import { getFormContext } from '$lib/form';
  import { css, cx, sva } from '$styled-system/css';
  import type { RecipeVariant } from '$styled-system/css';
  import type { SystemStyleObject } from '$styled-system/types';

  export let name: string | undefined = undefined;
  export let style: SystemStyleObject | undefined = undefined;
  export let variant: Variants['variant'] = 'gray';
  export let size: Variants['size'] = 'lg';

  const { field } = getFormContext();

  if (field) {
    name = field.name;
  }

  type Variants = RecipeVariant<typeof recipe>;
  const recipe = sva({
    slots: ['root', 'wrapper', 'item'],
    base: {
      root: { display: 'flex', alignItems: 'center', gap: '4px' },
      wrapper: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' },
      item: {
        position: 'relative',
        display: 'inline-block',
        flex: 'none',
        borderWidth: '1px',
        borderColor: 'gray.500',
        borderRadius: 'full',
        cursor: 'pointer',
        appearance: 'none',

        _checked: {
          _before: {
            content: '""',
            position: 'absolute',
            top: '1/2',
            left: '1/2',
            translate: 'auto',
            translateX: '-1/2',
            translateY: '-1/2',
            display: 'block',
            borderRadius: 'full',
            backgroundColor: 'gray.5',
          },
        },
      },
    },
    variants: {
      variant: {
        gray: {
          item: {
            _checked: {
              borderColor: 'gray.900',
              backgroundColor: 'gray.900',
            },
          },
        },
        cyan: {
          item: {
            _checked: {
              borderColor: 'cyan.400',
              backgroundColor: 'cyan.400',
            },
          },
        },
      },
      size: {
        sm: {
          root: { fontSize: '14px' },
          wrapper: { size: '18px' },
          item: {
            size: '13px',

            _checked: {
              size: '14px',
              _before: {
                size: '[4.5px]',
              },
            },
          },
        },
        lg: {
          root: { fontSize: '15px' },
          wrapper: { size: '22px' },
          item: {
            size: '16px',

            _checked: {
              size: '17px',
              _before: {
                size: '[5.5px]',
              },
            },
          },
        },
      },
    },
  });

  $: classes = recipe({ variant, size });
</script>

<label class={cx(classes.root, css(style))}>
  <div class={classes.wrapper}>
    <input id={name} {name} class={classes.item} type="radio" on:change {...$$restProps} />
  </div>
  <slot />
</label>
