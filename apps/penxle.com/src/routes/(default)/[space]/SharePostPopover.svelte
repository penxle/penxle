<script lang="ts">
  import qs from 'query-string';
  import { uid } from 'radash';
  import { tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import IconMastodon from '~icons/simple-icons/mastodon';
  import IconTwitter from '~icons/simple-icons/twitter';
  import IconX from '~icons/tabler/x';
  import { Icon } from '$lib/components';
  import Button from '$lib/components/v2/Button.svelte';
  import { toast } from '$lib/notification';
  import { createFloatingActions, portal } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { SystemStyleObject } from '$styled-system/types';

  type $$Props = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'class' | 'style'> & {
    href: string;
    style?: SystemStyleObject;
  };

  export let style: SystemStyleObject | undefined = undefined;
  export let href: string;
  let open = false;
  const id = 'share-popover-' + uid(2);
  const twitterLinkId = id + '-twitter-button';
  const mastodonLinkId = id + '-mastodon-button';

  const shareTargetMenuLinkWarpClassname = css({
    'position': 'relative',
    'display': 'flex',
    'flexDirection': 'column',
    'alignItems': 'center',
    'gap': '6px',

    '& > label': {
      fontSize: '13px',
      fontWeight: 'medium',
      color: 'gray.500',
    },
  });

  const shareTargetMenuLinkClassName = css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '8px',
    size: '64px',
    color: 'gray.500',
    backgroundColor: { base: 'gray.50', _hover: 'gray.150', _focusVisible: 'gray.150' },
    _after: {
      content: '""',
      position: 'absolute',
      inset: '0',
      cursor: 'pointer',
    },
  });

  const { floating, anchor, update } = createFloatingActions({ placement: 'bottom-end', offset: 16 });

  $: if (open) {
    // eslint-disable-next-line unicorn/prefer-top-level-await
    void tick().then(() => update());
  }
</script>

{#if open}
  <div
    class={css({
      position: 'fixed',
      inset: '0',
      zIndex: '1',
      smDown: {
        backgroundColor: 'gray.900/50',
        transition: 'opacity',
        backdropFilter: 'auto',
        backdropBlur: '8px',
        zIndex: '10',
      },
    })}
    role="button"
    tabindex="-1"
    on:click={() => (open = false)}
    on:keypress={null}
    use:portal
  />
{/if}

<button
  class={css(style)}
  aria-controls={id}
  aria-expanded={open}
  type="button"
  on:click={() => (open = !open)}
  use:anchor
>
  <slot />
</button>

{#if open}
  <div
    {id}
    role="region"
    use:floating
    {...$$restProps}
    class={css({
      borderWidth: '1px',
      borderColor: 'gray.200',
      borderRadius: '10px',
      backgroundColor: 'gray.5',
      sm: {
        width: '376px',
        boxShadow: '[0px 6px 18px 0px {colors.gray.900/12}]',
        zIndex: '2',
      },
      smDown: {
        position: '[fixed!]',
        top: '[initial!]',
        bottom: '[0!]',
        left: '[0!]',
        right: '[0!]',
        borderBottomRadius: '0',
        width: 'full',
        boxShadow: '[0px 8px 24px 0px {colors.gray.900/28}]',
        zIndex: '50',
      },
    })}
    transition:fade={{ duration: 100 }}
  >
    <header
      class={flex({
        justify: 'space-between',
        align: 'center',
        borderBottomWidth: '1px',
        borderBottomColor: 'gray.100',
        paddingX: '20px',
        paddingY: '12px',
        color: 'gray.900',
      })}
    >
      <h1 class={css({ fontWeight: 'semibold' })}>공유하기</h1>

      <button aria-label="닫기" type="button" on:click={() => (open = false)}>
        <Icon icon={IconX} size={24} />
      </button>
    </header>

    <div class={flex({ justify: 'center', gap: '16px', paddingY: '20px' })} role="group">
      <div class={shareTargetMenuLinkWarpClassname}>
        <a
          id={twitterLinkId}
          class={shareTargetMenuLinkClassName}
          href={qs.stringifyUrl({
            url: 'https://twitter.com/intent/tweet',
            query: { text: href },
          })}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon style={css.raw({ color: '[#1D9BF0]' })} icon={IconTwitter} size={32} />
        </a>
        <label for={twitterLinkId}>트위터</label>
      </div>
      <div class={shareTargetMenuLinkWarpClassname}>
        <a
          id={mastodonLinkId}
          class={shareTargetMenuLinkClassName}
          href={qs.stringifyUrl({
            url: 'https://share.planet.moe/share',
            query: { text: href },
          })}
        >
          <Icon style={css.raw({ color: '[#6364FF]' })} icon={IconMastodon} size={32} />
        </a>
        <label for={mastodonLinkId}>마스토돈</label>
      </div>
    </div>
    <footer
      class={flex({
        margin: '20px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '4px',
      })}
    >
      <input
        class={css({
          flex: '1',
          padding: '12px',
          fontSize: '14px',
        })}
        readonly
        type="text"
        value={href}
      />
      <Button
        style={css.raw({
          flex: 'none',
          outlineWidth: '0',
          borderLeftRadius: '0',
          borderRightRadius: '4px',
          borderRightWidth: '1px',
        })}
        size="lg"
        type="button"
        variant="gray-sub-fill"
        on:click={async () => {
          try {
            navigator.clipboard.writeText(href);
          } catch (err) {
            toast('클립보드 복사를 실패했어요');
            console.error(err);
          }
        }}
      >
        복사
      </Button>
    </footer>
  </div>
{/if}
