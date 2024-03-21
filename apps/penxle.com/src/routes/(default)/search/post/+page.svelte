<script lang="ts">
  import qs from 'query-string';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { Helmet, Pagination, PostCard } from '$lib/components';
  import { TabHead, TabHeadItem } from '$lib/components/tab';
  import { css } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import { initSearchFilter } from '../util';

  $: query = graphql(`
    query SearchPostPage_Query(
      $query: String!
      $includeTags: [String!]! = []
      $excludeTags: [String!]! = []
      $adultFilter: Boolean
      $orderBy: SearchOrderByKind!
      $page: Int! = 1
    ) {
      searchPosts(
        query: $query
        includeTags: $includeTags
        excludeTags: $excludeTags
        adultFilter: $adultFilter
        orderBy: $orderBy
        page: $page
      ) {
        count

        posts {
          id
          ...Feed_post
        }
      }
    }
  `);

  let {
    includeTags,
    excludeTags,
    adultFilter,
    excludeContentFilters,
    orderBy,
    page: initialPage,
  } = initSearchFilter($page.url.search);

  const updateSearchFilter = (currentPage: number) => {
    const stringifiedURL = qs.stringifyUrl(
      {
        url: '/search/post',
        query: {
          q: $page.url.searchParams.get('q'),
          include_tags: includeTags,
          exclude_tags: excludeTags,
          adult: adultFilter,
          exclude_triggers: excludeContentFilters,
          order_by: orderBy,
          page: currentPage,
        },
      },
      {
        skipNull: false,
      },
    );

    location.href = stringifiedURL;
  };

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
  약 {$query.searchPosts.count}개의 검색결과가 있어요!
</div>

<TabHead
  style={css.raw({
    fontSize: '18px',
    width: 'full',
    smDown: { position: 'sticky', zIndex: '1', top: '56px' },
    sm: { marginBottom: '16px' },
  })}
  {search}
>
  <TabHeadItem id={0} pathname="/search">전체</TabHeadItem>
  <TabHeadItem id={1} pathname="/search/post">포스트</TabHeadItem>
  <TabHeadItem id={2} pathname="/search/space">스페이스</TabHeadItem>
  <TabHeadItem id={3} pathname="/search/tag">태그</TabHeadItem>
</TabHead>

{#if $query.searchPosts.count === 0}
  <div
    class={center({ fontSize: '15px', fontWeight: 'bold', color: 'gray.500', textAlign: 'center', minHeight: '200px' })}
  >
    검색 결과가 없어요
  </div>
{:else}
  <div class={css({ smDown: { backgroundColor: 'gray.50' } })}>
    {#each $query.searchPosts.posts as post (post.id)}
      <PostCard style={css.raw({ marginTop: '16px', _firstOfType: { marginTop: '0' } })} $post={post} />
    {/each}
    <Pagination {initialPage} onChange={updateSearchFilter} totalItems={$query.searchPosts.count} />
  </div>
{/if}
