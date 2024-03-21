<script lang="ts">
  import dayjs from 'dayjs';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import { fragment, graphql } from '$glitch';
  import { Chip, Icon, Image, Tag } from '$lib/components';
  import { humanizeNumber } from '$lib/utils';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import type { SpaceFeed_post } from '$glitch';
  import type { SystemStyleObject } from '$styled-system/types';

  let _post: SpaceFeed_post;
  export { _post as $post };
  export let style: SystemStyleObject | undefined = undefined;

  $: post = fragment(
    _post,
    graphql(`
      fragment SpaceFeed_post on Post {
        id
        permalink
        blurred
        publishedAt
        hasPassword
        viewCount
        discloseStats
        ageRating

        tags {
          id
          kind

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
          previewText
          price
        }

        space @_required {
          id
          slug
          name

          icon {
            id
            ...Image_image
          }
        }

        member @_required {
          id

          profile {
            id
            name
            ...Avatar_profile
          }
        }
      }
    `),
  );

  $: triggerTags = $post.tags.filter(({ kind }) => kind === 'TRIGGER');
</script>

<article
  class={css(
    {
      paddingY: '16px',
      paddingX: '24px',
      backgroundColor: 'gray.5',
      width: 'full',
      maxWidth: '800px',
      transition: 'common',
      sm: {
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '16px',
        _hover: {
          borderColor: 'gray.900',
          boxShadow: '[0 4px 16px 0 {colors.gray.900/25}]',
        },
      },
    },
    style,
  )}
>
  <a
    class={flex({
      flexDirection: 'column',
      gap: '8px',
    })}
    href={`/${$post.space.slug}/${$post.permalink}`}
  >
    <div class={flex({ align: 'center', gap: '12px', truncate: true })}>
      <h2 class={css({ flexGrow: '1', fontSize: '20px', fontWeight: 'bold', truncate: true })}>
        {$post.publishedRevision?.title ?? '(제목 없음)'}
      </h2>

      <div class={flex({ gap: '4px' })}>
        {#if $post.publishedRevision?.price}
          <Chip style={css.raw({ marginBottom: '4px', width: 'fit' })} color="blue">유료</Chip>
        {/if}
        {#if $post.ageRating === 'R19'}
          <Chip style={css.raw({ marginBottom: '4px', width: 'fit' })} color="pink">성인물</Chip>
        {/if}
        {#if triggerTags.length > 0}
          <Chip style={css.raw({ marginBottom: '4px', width: 'fit' })} color="violet">트리거</Chip>
        {/if}
        {#if $post.hasPassword}
          <Chip style={css.raw({ marginBottom: '4px', width: 'fit' })} color="gray">비밀글</Chip>
        {/if}
      </div>
    </div>
    <p class={css({ marginTop: '4px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
      {$post.member.profile.name}
      {#if $post.discloseStats}
        · 조회수 {humanizeNumber($post.viewCount)}
      {/if}
    </p>

    <article
      class={css(
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderRadius: '8px',
          sm: {
            flexDirection: 'row',
          },
        },
        $post.blurred && { minHeight: '132px' },
      )}
    >
      {#if $post.blurred}
        <header
          class={center({
            flexDirection: 'column',
            gap: '10px',
            borderWidth: '1px',
            borderColor: 'gray.200',
            borderRadius: '16px',
            padding: '16px',
            color: 'gray.500',
            backgroundColor: 'gray.50',
            size: 'full',
          })}
          role="alert"
        >
          <Icon icon={IconAlertTriangle} size={24} />
          <p class={css({ fontSize: '14px', fontWeight: 'semibold', textAlign: 'center' })}>
            포스트에 민감한 내용이 포함되어 있어요
          </p>

          {#if triggerTags.length > 0}
            <div class={center({ gap: '10px', flexWrap: 'wrap' })}>
              <span
                class={flex({
                  align: 'center',
                  borderWidth: '1px',
                  borderColor: 'gray.200',
                  borderRadius: '8px',
                  paddingX: '12px',
                  fontSize: '13px',
                  fontWeight: 'medium',
                  backgroundColor: 'gray.100',
                  height: '24px',
                })}
              >
                {triggerTags[0].tag.name.replaceAll('_', ' ')}
              </span>
              {#if triggerTags.length > 1}
                <span
                  class={flex({
                    align: 'center',
                    borderWidth: '1px',
                    borderColor: 'gray.200',
                    borderRadius: '8px',
                    paddingX: '12px',
                    fontSize: '13px',
                    fontWeight: 'medium',
                    backgroundColor: 'gray.100',
                    height: '24px',
                  })}
                >
                  그 외 태그 {triggerTags.length - 1}개
                </span>
              {/if}
            </div>
          {/if}
        </header>
      {:else}
        <p
          class={css({
            flexGrow: '1',
            fontWeight: 'medium',
            color: 'gray.500',
            wordBreak: 'break-all',
            lineClamp: '4',
            whiteSpace: 'pre-wrap',
          })}
        >
          {$post.publishedRevision.previewText}
        </p>

        {#if $post.thumbnail}
          <Image
            style={css.raw({ flex: 'none', borderRadius: '6px', size: '120px', sm: { aspectRatio: '1/1' } })}
            $image={$post.thumbnail}
          />
        {/if}
      {/if}
    </article>
  </a>
  <div class={flex({ align: 'center', justify: 'space-between', gap: '12px', marginTop: '8px' })}>
    {#if $post.tags}
      <div class={flex({ gap: '6px', flexWrap: 'wrap' })}>
        {#each $post.tags.slice(0, 4) as { tag } (tag.id)}
          <Tag style={css.raw({ maxWidth: '260px' })} href={`/tag/${tag.name}`} size="sm">#{tag.name}</Tag>
        {/each}
        {#if $post.tags.length > 4}
          <Tag size="sm">+{$post.tags.length - 4}개의 태그</Tag>
        {/if}
      </div>
    {/if}

    <time
      class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500', whiteSpace: 'pre-wrap' })}
      datetime={$post.publishedAt}
    >
      {dayjs($post.publishedAt).formatAsDate()}
    </time>
  </div>
</article>
