<script lang="ts">
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import IconChevronLeftPipe from '~icons/tabler/chevron-left-pipe';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import IconChevronRightPipe from '~icons/tabler/chevron-right-pipe';
  import { Icon } from '$lib/components';
  import { css } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import type { SystemStyleObject } from '$styled-system/types';

  export let initialPage: number;
  export let totalItems: number;
  export let itemsPerPage = 10;
  export let displayPage = 6;
  export let onChange: (page: number) => void;
  export let style: SystemStyleObject | undefined = undefined;

  let currentPage = initialPage;

  $: maxPage = Math.ceil(totalItems / itemsPerPage);
  $: currentPageGroup = Math.ceil(currentPage / displayPage);
  $: totalPageGroup = Math.ceil(maxPage / displayPage);
  $: remainingPage = maxPage - (currentPageGroup - 1) * displayPage;

  $: range = [...Array.from({ length: remainingPage < displayPage ? remainingPage : displayPage }).keys()].map(
    (index) => (currentPageGroup - 1) * displayPage + (index + 1),
  );

  $: if (initialPage !== currentPage) {
    onChange(currentPage);
  }
</script>

<div
  class={css(
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      marginTop: '36px',
      paddingBottom: '16px',
    },
    style,
  )}
  role="group"
>
  <button
    class={center({
      color: { base: 'gray.600', _disabled: 'gray.300' },
      size: '32px',
      backgroundColor: { base: 'gray.5', _enabled: { _hover: 'gray.100', _pressed: 'gray.200' } },
      _disabled: { cursor: 'not-allowed' },
    })}
    disabled={currentPage === 1}
    type="button"
    on:click={() => {
      currentPage = 1;
    }}
  >
    <Icon icon={IconChevronLeftPipe} size={12} />
  </button>
  <button
    class={center({
      color: { base: 'gray.600', _disabled: 'gray.300' },
      size: '32px',
      backgroundColor: { base: 'gray.5', _enabled: { _hover: 'gray.100', _pressed: 'gray.200' } },
      _disabled: { cursor: 'not-allowed' },
    })}
    disabled={currentPage <= displayPage}
    type="button"
    on:click={() => {
      const previousPageGroup = currentPageGroup - 1;
      currentPage = previousPageGroup * displayPage;
    }}
  >
    <Icon icon={IconChevronLeft} size={12} />
  </button>
  {#each range as index (index)}
    <button
      class={center({
        padding: '8px',
        size: '32px',
        color: { base: 'gray.600', _focusVisible: 'gray.600', _pressed: 'gray.5' },
        fontSize: '14px',
        backgroundColor: { base: 'gray.5', _hover: 'gray.100', _focusVisible: 'gray.200', _pressed: 'gray.900' },
        transition: 'common',
      })}
      aria-pressed={currentPage === index}
      type="button"
      on:click={() => {
        currentPage = index;
      }}
    >
      {index}
    </button>
  {/each}
  <button
    class={center({
      color: { base: 'gray.600', _disabled: 'gray.300' },
      size: '32px',
      backgroundColor: { base: 'gray.5', _enabled: { _hover: 'gray.100', _pressed: 'gray.200' } },
      _disabled: { cursor: 'not-allowed' },
    })}
    disabled={currentPageGroup === totalPageGroup}
    type="button"
    on:click={() => {
      const nextPageGroup = currentPageGroup + 1;
      currentPage = nextPageGroup * displayPage - (displayPage - 1);
    }}
  >
    <Icon icon={IconChevronRight} size={12} />
  </button>
  <button
    class={center({
      color: { base: 'gray.600', _disabled: 'gray.300' },
      size: '32px',
      backgroundColor: { base: 'gray.5', _enabled: { _hover: 'gray.100', _pressed: 'gray.200' } },
      _disabled: { cursor: 'not-allowed' },
    })}
    disabled={currentPage === maxPage}
    type="button"
    on:click={() => {
      currentPage = maxPage;
    }}
  >
    <Icon icon={IconChevronRightPipe} size={12} />
  </button>
</div>
