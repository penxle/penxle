<script lang="ts">
  import TabHead from '$lib/components/tab/TabHead.svelte';
  import TabHeadItem from '$lib/components/tab/TabHeadItem.svelte';
  import { css } from '$styled-system/css';
</script>

<div
  class={css({
    fontSize: '15px',
    backgroundColor: 'gray.5',
    sm: { borderWidth: '1px', borderColor: 'gray.200', borderRadius: '16px' },
  })}
>
  <h2
    class={css({
      marginTop: '32px',
      marginBottom: '16px',
      paddingX: '32px',
      fontSize: '20px',
      fontWeight: 'bold',
      hideBelow: 'sm',
    })}
  >
    설정
  </h2>

  <TabHead style={css.raw({ fontSize: '18px', width: 'full', sm: { paddingX: '32px' } })}>
    <TabHeadItem id={1} pathname="/me/settings">계정</TabHeadItem>
    <TabHeadItem id={2} pathname="/me/settings/notifications">알림</TabHeadItem>
    <TabHeadItem id={3} pathname="/me/settings/contentfilters">필터링</TabHeadItem>
  </TabHead>

  <slot />
</div>
