<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { css } from '$styled-system/css';
  import type { SystemStyleObject } from '$styled-system/types';

  export let style: SystemStyleObject | undefined = undefined;

  let _search: string | undefined = undefined;
  export { _search as search };
  let search = writable<string | undefined>(_search);

  setContext('search', search);

  $: $search = _search;
</script>

<ul
  class={css(
    { display: 'flex', gap: '20px', paddingX: '20px', paddingY: '8px', fontSize: '22px', width: 'fit' },
    style,
  )}
  role="tablist"
>
  <slot />
</ul>
