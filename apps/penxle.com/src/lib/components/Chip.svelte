<script lang="ts">
  import { css, cva } from '$styled-system/css';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { RecipeVariant, RecipeVariantProps, SystemStyleObject } from '$styled-system/types';

  type $$Props = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'style'> & {
    style?: SystemStyleObject;
  } & RecipeVariantProps<typeof recipe>;

  export let style: SystemStyleObject | undefined = undefined;
  export let color: Variants['color'] = 'gray';

  type Variants = RecipeVariant<typeof recipe>;
  const recipe = cva({
    base: {
      paddingX: '4px',
      paddingY: '1px',
      borderWidth: '1px',
      fontSize: '11px',
      fontWeight: 'medium',
      backgroundColor: 'gray.5',
    },
    variants: {
      color: {
        red: { borderColor: '[#DC3D43BD]', color: 'red.600' },
        grass: { borderColor: '[#18794EBD]', color: '[#18794E]' },
        blue: { borderColor: '[#3451B2BD]', color: '[#3451B2]' },
        pink: { borderColor: '[#CD1D8DBD]', color: '[#CD1D8D]' },
        violet: { borderColor: '[#5746AFBD]', color: '[#5746AF]' },
        gray: { borderColor: '[#595959BD]', color: 'gray.600' },
      },
    },
  });
</script>

<div class={css(recipe.raw({ color }), style)} {...$$restProps}>
  <slot />
</div>
