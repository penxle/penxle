<script lang="ts">
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Helmet, Tag } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';

  $: query = graphql(`
    query SearchTagPage_Query($query: String!) {
      searchTags(query: $query) {
        id
        name
      }
    }
  `);

  $: search = `?q=${$page.url.searchParams.get('q')}`;
  $: keyword = $page.url.searchParams.get('q');
</script>

<Helmet description={`펜슬에서 ${keyword} 검색을 한 결과에요`} title={`${keyword} 검색 결과`} />

<div
  class={css({
    marginTop: '12px',
    fontSize: '14px',
    fontWeight: 'medium',
    color: 'gray.500',
    smDown: { marginLeft: '16px' },
  })}
>
  약 {$query.searchTags.length ?? 0}개의 검색결과가 있어요!
</div>

<TabHead
  style={css.raw({
    fontSize: '18px',
    width: 'full',
    smDown: { position: 'sticky', zIndex: '1', top: '56px' },
  })}
  {search}
>
  <TabHeadItem id={0} pathname="/search">전체</TabHeadItem>
  <TabHeadItem id={1} pathname="/search/post">포스트</TabHeadItem>
  <TabHeadItem id={2} pathname="/search/space">스페이스</TabHeadItem>
  <TabHeadItem id={3} pathname="/search/tag">태그</TabHeadItem>
</TabHead>

{#if $query.searchTags.length === 0}
  <div
    class={center({ fontSize: '15px', fontWeight: 'bold', color: 'gray.500', textAlign: 'center', minHeight: '200px' })}
  >
    검색 결과가 없어요
  </div>
{:else}
  <div class={flex({ flexWrap: 'wrap', gap: '12px', smDown: { paddingX: '16px' } })}>
    {#each $query.searchTags as tag (tag.id)}
      <Tag href={`/tag/${tag.name}`} size="lg">#{tag.name}</Tag>
    {/each}
  </div>
{/if}
