<script lang="ts">
  import { expoInOut, linear } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import IconCircleXFilled from '~icons/tabler/circle-x-filled';
  import { Icon } from '$lib/components';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import { store } from './store';
  import type { Toast } from './store';

  export let toast: Toast;

  const dismiss = () => store.update((v) => v.filter((t) => t.id !== toast.id));
  const progress = tweened(100, { duration: toast.duration, easing: linear });

  $: if ($progress === 0) {
    dismiss();
  }
</script>

<div
  class={flex({
    align: 'center',
    borderWidth: '1px',
    borderColor: 'red.600',
    paddingX: '16px',
    paddingY: '12px',
    width: 'fit',
    minWidth: '44px',
    maxWidth: { base: '311px', sm: '420px' },
    minHeight: '46px',
    backgroundColor: 'red.50',
    overflow: 'hidden',
    pointerEvents: 'auto',
  })}
  on:introend={() => ($progress = 0)}
  in:fade={{ duration: 400, delay: 300, easing: expoInOut }}
  out:fade={{ duration: 400, delay: 200, easing: expoInOut }}
>
  <div
    class={css({
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flex: 'none',
      overflow: 'hidden',
    })}
  >
    <Icon style={css.raw({ color: 'red.600' })} icon={IconCircleXFilled} />
  </div>

  <div>
    <div class={flex({ align: 'center', paddingLeft: '6px', color: 'red.600' })}>
      <span class={css({ fontSize: '13px', wordBreak: 'break-all' })}>
        {toast.message}
      </span>
    </div>
  </div>
</div>
