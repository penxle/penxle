<script lang="ts">
  import { fragment, graphql } from '$glitch';
  import { Chip, Image, Tag } from '$lib/components';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { PostItem_post } from '$glitch';

  let _post: PostItem_post;
  export { _post as $post };

  $: post = fragment(
    _post,
    graphql(`
      fragment PostItem_post on Post {
        id
        blurred
        permalink

        tags {
          id

          tag {
            id
            name
          }
        }

        thumbnail {
          id
          ...Image_image
        }

        publishedRevision @_required {
          id
          title
          price
          previewText
        }

        space @_required {
          id
          name
          slug
        }

        member @_required {
          id

          profile {
            id
            name
          }
        }
      }
    `),
  );
</script>

<li
  class={css({
    borderWidth: '1px',
    borderColor: 'gray.200',
    borderRadius: '16px',
    paddingX: '24px',
    paddingY: '16px',
    backgroundColor: 'gray.5',
    transition: 'common',
    _hover: {
      borderColor: 'gray.900',
      boxShadow: '[0 4px 16px 0 {colors.gray.900/25}]',
    },
  })}
>
  <a href={`/${$post.space.slug}/${$post.permalink}`}>
    <div class={flex({ wrap: 'wrap', gap: '4px' })}>
      {#if $post.publishedRevision?.price}
        <Chip style={css.raw({ marginBottom: '8px', width: 'fit' })} color="pink">유료</Chip>
      {/if}
      {#if $post.blurred}
        <Chip style={css.raw({ marginBottom: '8px', width: 'fit' })} color="violet">트리거</Chip>
      {/if}
    </div>

    <div class={flex({ justify: 'space-between', gap: '16px' })}>
      <div>
        <p class={css({ fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}>
          {$post.space.name} · {$post.member.profile.name}
        </p>
        <p class={css({ fontSize: '20px', fontWeight: 'bold', wordBreak: 'break-all' })}>
          {$post.publishedRevision.title ?? '(제목 없음)'}
        </p>
        <p
          class={css({
            fontSize: '14px',
            fontWeight: 'medium',
            color: 'gray.500',
            wordBreak: 'break-all',
            lineClamp: '2',
            whiteSpace: 'pre-line',
          })}
        >
          {$post.publishedRevision?.previewText}
        </p>
      </div>
      {#if $post.thumbnail}
        <Image
          style={css.raw({
            flex: 'none',
            borderWidth: '1px',
            borderColor: 'gray.200',
            borderRadius: '[20px]',
            size: '100px',
            objectFit: 'cover',
          })}
          $image={$post.thumbnail}
        />
      {/if}
    </div>
  </a>
  {#if $post.tags}
    <div class={flex({ wrap: 'wrap', gap: '6px', marginTop: '8px' })}>
      {#each $post.tags.slice(0, 4) as { tag } (tag.id)}
        <Tag href={`/tag/${tag.name}`} size="sm">#{tag.name}</Tag>
      {/each}
      {#if $post.tags.length > 4}
        <Tag size="sm">+{$post.tags.length - 4}개의 태그</Tag>
      {/if}
    </div>
  {/if}
</li>
