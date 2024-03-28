<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { portal, scrollLock } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';

  export let open: boolean;
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

    <div
      class={css({
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingX: '32px',
        width: 'full',
        pointerEvents: 'none',
      })}
    >
      <div
        class={css({
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: 'full',
          maxWidth: { base: '311px', sm: '420px' },
          backgroundColor: 'gray.5',
          pointerEvents: 'auto',
          userSelect: 'text',
        })}
        use:scrollLock
        in:fly={{ y: 10 }}
        out:fade={{ duration: 150 }}
      >
        <header
          class={css({
            paddingTop: { base: '40px', sm: '28px' },
            paddingX: { base: '16px', sm: '32px' },
          })}
        >
          <h3
            class={css({
              fontSize: { base: '16px', sm: '18px' },
              fontWeight: 'semibold',
              textAlign: 'center',
              wordBreak: 'keep-all',
            })}
          >
            <slot name="title" />
          </h3>
        </header>

        {#if $$slots.content}
          <div
            class={css({
              marginTop: '8px',
              paddingX: { base: '16px', sm: '32px' },
              fontSize: { base: '14px', sm: '16px' },
              color: 'gray.500',
              textAlign: 'center',
            })}
          >
            <slot name="content" />
          </div>
        {/if}

        <div
          class={css({
            display: 'grid',
            gridTemplateColumns: '2',
            alignItems: 'center',
            marginTop: { base: '40px', sm: '20px' },
            width: 'full',
            backgroundColor: 'gray.5',
            sm: {
              gap: '8px',
              paddingTop: '12px',
              paddingX: '86px',
              paddingBottom: '24px',
            },
          })}
        >
          <slot name="action" />
        </div>
      </div>
    </div>
  </div>
{/if}
