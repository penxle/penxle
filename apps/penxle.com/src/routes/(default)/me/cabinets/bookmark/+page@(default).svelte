<script lang="ts">
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import { graphql } from '$glitch';
  import { Helmet, Icon, PostCard } from '$lib/components';
  import { css } from '$styled-system/css';
  import { center } from '$styled-system/patterns';

  $: query = graphql(`
    query MeCabinetsBookmarkPage_Query {
      me @_required {
        id

        bookmarkGroups {
          id
          name
          postCount

          posts {
            id
            ...Feed_post
          }
        }
      }
    }
  `);
</script>

<Helmet description="북마크한 포스트 목록을 둘러보세요" title="북마크한 포스트" />

<div
  class={center({
    borderBottomWidth: '1px',
    borderColor: 'gray.200',
    backgroundColor: 'gray.5',
    width: 'full',
    height: '60px',
    hideBelow: 'sm',
  })}
>
  <a href="/me/cabinets">
    <Icon style={css.raw({ color: 'gray.500' })} icon={IconChevronLeft} size={24} />
  </a>
  <h1 class={css({ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', width: 'full', maxWidth: '800px' })}>
    북마크
  </h1>
</div>

<div class={css({ marginY: '28px', width: 'full', maxWidth: '800px' })}>
  <p class={css({ fontSize: '18px', fontWeight: 'bold' })}>{$query.me.bookmarkGroups[0].postCount}개의 포스트</p>

  <div class={css({ marginTop: '36px' })}>
    {#each $query.me.bookmarkGroups[0].posts as post (post.id)}
      <PostCard
        style={css.raw({ marginBottom: { base: '46px', _lastOfType: '0' } })}
        $post={post}
        showSpaceInfoMessage
      />
    {/each}
  </div>
</div>
