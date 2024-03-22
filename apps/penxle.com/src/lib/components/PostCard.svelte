<script lang="ts">
  import dayjs from 'dayjs';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import IconBookmark from '~icons/tabler/bookmark';
  import IconBookmarkFilled from '~icons/tabler/bookmark-filled';
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Avatar, Badge, Icon, Image, Tag } from '$lib/components';
  import { toast } from '$lib/notification';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import type { Feed_post } from '$glitch';
  import type { SystemStyleObject } from '$styled-system/types';

  let _post: Feed_post;
  export { _post as $post };

  export let showSpaceInfoMessage = false;
  export let style: SystemStyleObject | undefined = undefined;

  $: post = fragment(
    _post,
    graphql(`
      fragment Feed_post on Post {
        id
        permalink
        blurred
        publishedAt
        hasPassword
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

        bookmarkGroups {
          id
        }
      }
    `),
  );

  const bookmarkPost = graphql(`
    mutation Feed_BookmarkPost_Mutation($input: BookmarkPostInput!) {
      bookmarkPost(input: $input) {
        id

        bookmarkGroups {
          id
        }
      }
    }
  `);

  const unbookmarkPost = graphql(`
    mutation Feed_UnbookmarkPost_Mutation($input: UnbookmarkPostInput!) {
      unbookmarkPost(input: $input) {
        id

        bookmarkGroups {
          id
        }
      }
    }
  `);

  const toggleBookmark = async () => {
    if ($post.bookmarkGroups.length > 0) {
      await unbookmarkPost({ bookmarkGroupId: $post.bookmarkGroups[0].id, postId: $post.id });
      mixpanel.track('post:unbookmark', { postId: $post.id, via: 'feed' });
      toast.success('북마크에서 삭제했어요');
    } else {
      await bookmarkPost({ postId: $post.id });
      mixpanel.track('post:bookmark', { postId: $post.id, via: 'feed' });
      toast.success('북마크에 저장되었어요');
    }
  };

  $: triggerTags = $post.tags.filter(({ kind }) => kind === 'TRIGGER');
</script>

{#if showSpaceInfoMessage}
  <div class={flex({ align: 'center', gap: '12px', marginTop: '8px', marginBottom: '16px', truncate: true })}>
    <a class={css({ position: 'relative' })} href={`/${$post.space.slug}`}>
      <Image
        style={css.raw({
          flex: 'none',
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderRadius: '14px',
          size: '42px',
        })}
        $image={$post.space.icon}
      />
      <Avatar
        style={css.raw({
          position: 'absolute',
          right: '-4px',
          bottom: '-4px',
          flex: 'none',
          borderWidth: '1px',
          borderColor: 'gray.50',
          size: '24px',
        })}
        $profile={$post.member.profile}
      />
    </a>
    <a class={flex({ flexDirection: 'column', width: 'full', truncate: true })} href={`/${$post.space.slug}`}>
      <p class={css({ marginBottom: '2px', fontSize: '15px', fontWeight: 'bold', truncate: true, hideFrom: 'sm' })}>
        {$post.space.name} · {$post.member.profile.name}
      </p>

      <p class={css({ marginBottom: '2px', fontSize: '15px', fontWeight: 'bold', hideBelow: 'sm' })}>
        {$post.member.profile.name}님이 {$post.space.name}에
        <!-- prettier-ignore -->
        {#if $post.publishedRevision.price}
          <mark class={css({color: '[#58A8C3]'})}>유료글</mark>을
        {/if}
        게시했어요
      </p>
      <time class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
        {dayjs($post.publishedAt).fromNow()}
      </time>
    </a>
    <button type="button" on:click={toggleBookmark}>
      {#if $post.bookmarkGroups.length > 0}
        <Icon style={css.raw({ color: '[#FCD242]' })} icon={IconBookmarkFilled} size={20} />
      {:else}
        <Icon style={css.raw({ color: 'gray.900' })} icon={IconBookmark} size={20} />
      {/if}
    </button>
    <button type="button">
      <Icon style={css.raw({ color: 'gray.900' })} icon={IconDotsVertical} size={20} />
    </button>
  </div>
{/if}

<div
  class={css(
    {
      display: 'flex',
      flexDirection: 'column',
      width: 'full',
      backgroundColor: 'gray.5',
      sm: {
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '16px',
        transition: 'common',
        _hover: {
          borderColor: 'gray.900',
          boxShadow: '[0 4px 16px 0 {colors.gray.900/25}]',
        },
      },
    },
    $post.tags.length === 0 && showSpaceInfoMessage && { paddingBottom: '16px' },
    style,
  )}
>
  <a class={css({ paddingX: '24px', paddingTop: '16px' })} href={`/${$post.space.slug}/${$post.permalink}`}>
    <div class={flex({ flexWrap: 'wrap', gap: '4px' })}>
      {#if $post.publishedRevision.price}
        <Badge style={css.raw({ marginBottom: '4px', width: 'fit' })} color="purple">유료</Badge>
      {/if}
      {#if $post.ageRating === 'R19'}
        <Badge style={css.raw({ marginBottom: '4px', width: 'fit' })} color="red">성인물</Badge>
      {/if}
      {#if triggerTags.length > 0}
        <Badge style={css.raw({ marginBottom: '4px', width: 'fit' })} color="orange">트리거 주의</Badge>
      {/if}
      {#if $post.hasPassword}
        <Badge style={css.raw({ marginBottom: '4px', width: 'fit' })} color="gray">비밀글</Badge>
      {/if}
    </div>
    <h2
      class={css({
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '4px',
        truncate: true,
        sm: { fontSize: '20px' },
      })}
    >
      {$post.publishedRevision.title ?? '(제목 없음)'}
    </h2>
    <div>
      <article
        class={css(
          {
            display: 'flex',
            flexWrap: 'wrap',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            borderRadius: '8px',
            sm: {
              flexWrap: 'nowrap',
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
              borderColor: 'gray.50',
              borderRadius: '16px',
              padding: '16px',
              color: 'gray.500',
              size: 'full',
              backgroundColor: 'gray.5',
            })}
            role="alert"
          >
            <Icon icon={IconAlertTriangle} size={24} />
            <p class={css({ fontSize: '14px', fontWeight: 'semibold', textAlign: 'center', whiteSpace: 'pre-wrap' })}>
              포스트에 민감한 내용이 포함되어 있어요
            </p>

            {#if triggerTags.length > 0}
              <div class={center({ flexWrap: 'wrap', gap: '10px' })}>
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
              color: 'gray.500',
              fontWeight: 'medium',
              lineClamp: '4',
              wordBreak: 'break-all',
              whiteSpace: 'pre-line',
            })}
          >
            {$post.publishedRevision.previewText}
          </p>

          {#if $post.thumbnail}
            <Image
              style={css.raw({ size: '120px', borderRadius: '6px', flex: 'none', sm: { aspectRatio: '1/1' } })}
              $image={$post.thumbnail}
            />
          {/if}
        {/if}
      </article>
    </div>
  </a>

  {#if $post.tags.length > 0}
    <div
      class={css(
        { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', paddingX: '24px' },
        showSpaceInfoMessage && { paddingBottom: '16px' },
      )}
    >
      {#each $post.tags.slice(0, 4) as { tag } (tag.id)}
        <Tag style={css.raw({ maxWidth: '260px' })} href={`/tag/${tag.name}`} size="sm">#{tag.name}</Tag>
      {/each}
      {#if $post.tags.length > 4}
        <Tag size="sm">+{$post.tags.length - 4}개의 태그</Tag>
      {/if}
    </div>
  {/if}

  {#if !showSpaceInfoMessage}
    <a
      class={flex({ alignItems: 'center', gap: '12px', paddingX: '24px', paddingY: '16px', truncate: true })}
      href={`/${$post.space.slug}/${$post.permalink}`}
    >
      <Image
        style={css.raw({
          flex: 'none',
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderRadius: '8px',
          size: '24px',
        })}
        $image={$post.space.icon}
      />
      <p class={css({ flexGrow: '1', fontSize: '15px', fontWeight: 'semibold', truncate: true })}>
        {$post.space.name} · {$post.member.profile.name}
      </p>
      <time class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
        {dayjs($post.publishedAt).fromNow()}
      </time>
    </a>
  {/if}
</div>
