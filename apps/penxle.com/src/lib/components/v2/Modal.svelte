<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import IconX from '~icons/tabler/x';
  import { Icon } from '$lib/components';
  import { portal, scrollLock } from '$lib/svelte/actions';
  import { css, sva } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import type { SystemStyleObject } from '$styled-system/types';

  export let open: boolean;
  export let size: 'sm' | 'lg' = 'sm';
  export let style: SystemStyleObject | undefined = undefined;
  export let titleStyle: SystemStyleObject | undefined = undefined;
  export let actionStyle: SystemStyleObject | undefined = undefined;

  const recipe = sva({
    slots: ['root', 'container'],
    base: {
      root: {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: { base: 'flex-end', sm: 'center' },
        justifyContent: 'center',
        width: 'full',
        pointerEvents: 'none',
      },
      container: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: 'full',
        maxHeight: { base: '540px', sm: '600px' },
        backgroundColor: 'gray.5',
        pointerEvents: 'auto',
        userSelect: 'text',

        smDown: {
          borderTopWidth: '1px',
          borderTopColor: 'gray.600',
        },
      },
    },
    variants: {
      size: {
        sm: {
          container: {
            sm: { maxWidth: '420px' },
          },
        },
        lg: {
          container: {
            sm: { maxWidth: '712px' },
          },
        },
      },
    },
  });

  $: classes = recipe({ size });
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && (open = false)} />

{#if open}
  <div class={css({ position: 'fixed', inset: '0', zIndex: '50' })} use:portal>
    <div
      class={css({ position: 'absolute', inset: '0', backgroundColor: 'gray.900/60' })}
      role="button"
      tabindex="-1"
      on:click={() => (open = false)}
      on:keypress={null}
      transition:fade={{ duration: 150 }}
    />

    <div class={classes.root}>
      <div class={classes.container} use:scrollLock in:fly={{ y: 10 }} out:fade={{ duration: 150 }}>
        <header
          class={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            borderBottomWidth: '1px',
            borderBottomColor: 'gray.150',
            paddingX: '20px',
            paddingY: '15px',
          })}
        >
          <div class={center({ position: 'absolute', left: '0', paddingX: '20px' })}>
            <slot name="title-left" />
          </div>

          <h3
            class={css(
              {
                display: 'flex',
                justifyContent: 'center',
                flex: '1',
                marginX: '32px',
                fontSize: '18px',
                fontWeight: 'semibold',
                wordBreak: 'keep-all',
              },
              titleStyle,
            )}
          >
            <slot name="title" />
          </h3>

          <button
            class={css({ position: 'absolute', right: '0', paddingX: '20px' })}
            type="button"
            on:click={() => (open = false)}
          >
            <Icon icon={IconX} size={24} />
          </button>
        </header>

        <div
          class={css({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            width: 'full',
            overflowY: 'auto',
          })}
          data-scroll-lock-ignore
        >
          <div
            class={css(
              { paddingTop: '16px', paddingX: '20px', paddingBottom: { base: '52px', sm: '32px' }, overflowY: 'auto' },
              style,
            )}
          >
            <slot />
          </div>

          {#if $$slots.action}
            <div
              class={css(
                {
                  position: 'sticky',
                  bottom: '0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingX: '20px',
                  paddingY: '20px',
                  width: 'full',
                  backgroundColor: 'gray.5',
                },
                size === 'lg' && {
                  borderTopWidth: '1px',
                  borderTopColor: 'gray.150',
                },
                actionStyle,
              )}
            >
              <slot name="action" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
