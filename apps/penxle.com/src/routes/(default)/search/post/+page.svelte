<script lang="ts">
  import { Helmet } from '@penxle/ui';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Feed } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';

  $: query = graphql(`
    query SearchPostPage_Query($query: String!) {
      searchPosts(query: $query) {
        id
        ...Feed_post
      }
    }
  `);
</script>

<Helmet title="{$page.url.searchParams.get('q')} - 검색" />

<div class="body-14-m text-secondary py-1 px-3 rounded-lg bg-surface-primary mt-3">
  🔍 약 {$query.searchPosts.length ?? 0}개의 검색결과가 있어요!
</div>

<TabHead class="mt-9 mb-4 w-full" variant="secondary">
  <TabHeadItem id={0} href={`/search?q=${$page.url.searchParams.get('q')}`}>전체</TabHeadItem>
  <TabHeadItem id={1} href={`/search/post?q=${$page.url.searchParams.get('q')}`}>포스트</TabHeadItem>
  <TabHeadItem id={2} href={`/search/space?q=${$page.url.searchParams.get('q')}`}>스페이스</TabHeadItem>
  <TabHeadItem id={3} href={`/search/tag?q=${$page.url.searchParams.get('q')}`}>태그</TabHeadItem>
</TabHead>

{#if $query.searchPosts.length === 0}
  <div class="text-secondary body-15-b text-center flex center min-h-50">검색 결과가 없어요</div>
{:else}
  <div class="space-y-4">
    {#each $query.searchPosts as post (post.id)}
      <Feed $post={post} />
    {/each}
  </div>
{/if}