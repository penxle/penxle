<script lang="ts">
  import { getTextBetween } from '@tiptap/core';
  import dayjs from 'dayjs';
  import stringify from 'fast-json-stable-stringify';
  import IconRating15Plus from '~icons/effit/rating-15-plus';
  import IconRating20Plus from '~icons/effit/rating-20-plus';
  import IconAlertSquareRounded from '~icons/tabler/alert-square-rounded';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import IconBookmark from '~icons/tabler/bookmark';
  import IconBookmarkFilled from '~icons/tabler/bookmark-filled';
  import IconCheck from '~icons/tabler/check';
  import IconChevronRight from '~icons/tabler/chevron-right';
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import IconEye from '~icons/tabler/eye';
  import IconLockSquareRounded from '~icons/tabler/lock-square-rounded';
  import IconMessageCircle from '~icons/tabler/message-circle';
  import IconMessageCircleOff from '~icons/tabler/message-circle-off';
  import IconMoodSmile from '~icons/tabler/mood-smile';
  import IconPlus from '~icons/tabler/plus';
  import IconShare2 from '~icons/tabler/share-2';
  import { afterNavigate, goto } from '$app/navigation';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Avatar, Badge, Icon, Image, Tooltip } from '$lib/components';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { Button, Modal } from '$lib/components/v2';
  import { categoryFilter, pairFilter } from '$lib/const/feed';
  import { EmojiPicker } from '$lib/emoji';
  import Emoji from '$lib/emoji/Emoji.svelte';
  import { FormValidationError } from '$lib/errors';
  import { toast } from '$lib/notification';
  import { TiptapRenderer } from '$lib/tiptap/components';
  import { comma, humanizeNumber } from '$lib/utils';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../LoginRequireModal.svelte';
  import AlertText from './AlertText.svelte';
  import Comment from './Comment.svelte';
  import CommentInput from './CommentInput.svelte';
  import SelectionBubbleMenu from './SelectionBubbleMenu.svelte';
  import ShareContent from './ShareContent.svelte';
  import SharePostPopover from './SharePostPopover.svelte';
  import TagManageModal from './TagManageModal.svelte';
  import type { Editor } from '@tiptap/core';
  import type { Post_postRevision, Post_query } from '$glitch';
  import type { SystemStyleObject } from '$styled-system/types';

  let editor: Editor | undefined;
  let loginRequireOpen = false;
  let emojiOpen = false;
  let password = '';
  let openDeletePostWarning = false;
  let blurContent = true;
  let openShareContentModal = false;
  let openTagManageModal = false;

  export let style: SystemStyleObject | undefined = undefined;

  let _query: Post_query;
  export { _query as $query };

  let _postRevision: Post_postRevision;
  export { _postRevision as $postRevision };

  $: query = fragment(
    _query,
    graphql(`
      fragment Post_query on Query {
        me {
          id
          isAdulthood
          allowedAgeRating

          personalIdentity {
            id
          }

          bookmarkGroups {
            id
          }
        }

        post(permalink: $permalink) {
          id
          ...TagManageModal_post

          permalink
          shortlink
          reactionCount
          liked
          viewCount
          unlocked
          blurred
          hasPassword
          receiveFeedback
          discloseStats
          protectContent
          publishedAt
          ageRating
          category
          pairs
          commentCount
          paginationCount: commentCount(pagination: true)
          commentQualification

          tags {
            id
            kind

            tag {
              id
              name
            }
          }

          recommendedPosts {
            id
            permalink
            publishedAt
            ageRating
            hasPassword

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
              subtitle
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

          collection {
            id
            name
            count

            thumbnail {
              id
              ...Image_image
            }

            posts {
              id
              permalink

              publishedRevision {
                id
                title
                subtitle
              }
            }
          }

          previousPost {
            id
            permalink

            publishedRevision @_required {
              id
              title
              subtitle
            }
          }

          nextPost {
            id
            permalink

            publishedRevision @_required {
              id
              title
              subtitle
            }
          }

          bookmarkGroups {
            id
          }

          reactions {
            id
            emoji
            mine
          }

          space {
            id
            slug
            name
            description
            muted
            followed

            icon {
              id
              ...Image_image
            }

            meAsMember {
              id
              role
            }

            myMasquerade {
              id
              blocked
            }
          }

          member {
            id

            profile {
              id
              name
              ...Avatar_profile
            }
          }

          postComments: comments(orderBy: LATEST, page: 1, take: 1000) {
            id
            content
            createdAt
            pinned

            profile {
              id
              name
            }

            children {
              id
            }

            ...PostPage_Comment_postComment
          }
        }

        ...PostPage_Comment_query
        ...EmojiPicker_query
        ...CommentInput_query
      }
    `),
  );

  $: postRevision = fragment(
    _postRevision,
    graphql(`
      fragment Post_postRevision on PostRevision {
        id
        title
        subtitle
        content
        createdAt
        previewText
        paragraphIndent
        paragraphSpacing
      }
    `),
  );

  // $: comments = graphql(`
  //   query Post_Comments($permalink: String!, $orderBy: CommentOrderByKind!, $page: Int!, $take: Int!) @_manual {
  //     post(permalink: $permalink) {
  //       comments(orderBy: $orderBy, page: $page, take: $take) {
  //         id
  //         ...PostPage_Comment_postComment
  //       }
  //     }
  //   }
  // `);

  let page = 2;
  const take = 1000;

  // let _postComments: typeof $query.post.postComments = [];
  let initialize = false;
  // $: postComments = derived(comments, ($comments) => {
  //   return $comments?.post.comments ?? [];
  // });
  $: postComments = $query.post.postComments;

  $: if (!initialize) {
    // _postComments = $query.post.postComments;
    initialize = true;
  }

  const fetchComments = async () => {
    // const refetchedComments = await comments.refetch({
    //   permalink: $query.post.permalink,
    //   orderBy: 'LATEST',
    //   page,
    //   take,
    // });

    // _postComments = [..._postComments, ...refetchedComments.post.comments];
    page += 1;
  };

  $: if (blurContent) {
    blurContent = $query.post.blurred;
  }

  afterNavigate(() => {
    blurContent = $query.post.blurred;
  });

  const muteSpace = graphql(`
    mutation Post_MuteSpace_Mutation($input: MuteSpaceInput!) {
      muteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  const unmuteSpace = graphql(`
    mutation Post_UnmuteSpace_Mutation($input: UnmuteSpaceInput!) {
      unmuteSpace(input: $input) {
        id
        muted
      }
    }
  `);

  const unlockPasswordedPost = graphql(`
    mutation Post_UnlockPasswordedPost_Mutation($input: UnlockPasswordedPostInput!) {
      unlockPasswordedPost(input: $input) {
        id
        unlocked

        publishedRevision {
          id
          content
        }
      }
    }
  `);

  const followSpace = graphql(`
    mutation Post_FollowSpace_Mutation($input: FollowSpaceInput!) {
      followSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const unfollowSpace = graphql(`
    mutation Post_UnfollowSpace_Mutation($input: UnfollowSpaceInput!) {
      unfollowSpace(input: $input) {
        id
        followed
      }
    }
  `);

  const deletePost = graphql(`
    mutation Post_DeletePost_Mutation($input: DeletePostInput!) {
      deletePost(input: $input) {
        id

        space {
          id
          slug
        }
      }
    }
  `);

  const bookmarkPost = graphql(`
    mutation Post_BookmarkPost_Mutation($input: BookmarkPostInput!) {
      bookmarkPost(input: $input) {
        id

        bookmarkGroups {
          id
        }
      }
    }
  `);

  const unbookmarkPost = graphql(`
    mutation Post_UnbookmarkPost_Mutation($input: UnbookmarkPostInput!) {
      unbookmarkPost(input: $input) {
        id

        bookmarkGroups {
          id
        }
      }
    }
  `);

  $: triggerTags = $query.post.tags.filter(({ kind }) => kind === 'TRIGGER');
  $: shortLink = `https://pnxl.me/${$query.post.shortlink}`;
</script>

<article class={css({ flexGrow: '1', width: 'full', backgroundColor: 'gray.5' }, style)}>
  <div
    class={flex({
      direction: 'column',
      marginX: 'auto',
      marginBottom: '60px',
      paddingX: '80px',
      paddingTop: '42px',
      width: 'full',
      maxWidth: '1062px',
      smDown: {
        paddingTop: '24px',
        paddingX: '20px',
      },
    })}
  >
    {#if $query.post.collection}
      <a
        class={flex({ align: 'center', gap: '2px', marginBottom: '16px', fontSize: '14px', color: 'gray.500' })}
        href={`/${$query.post.space?.slug}/collections/${$query.post.collection.id}`}
      >
        {$query.post.collection.name}
        <Icon style={css.raw({ color: 'gray.500' })} icon={IconChevronRight} />
      </a>
    {/if}
    <div class={flex({ justify: 'space-between', align: 'flex-start' })}>
      <div>
        <h1 class={css({ fontSize: { base: '22px', sm: '28px' }, fontWeight: 'semibold', wordBreak: 'break-all' })}>
          {$postRevision.title ?? '(제목 없음)'}
        </h1>
        {#if $postRevision.subtitle}
          <h2 class={css({ marginTop: '3px', color: 'gray.600', wordBreak: 'break-all' })}>{$postRevision.subtitle}</h2>
        {/if}
      </div>

      <Menu placement="bottom-end">
        <Icon slot="value" style={css.raw({ color: 'gray.500', hideFrom: 'sm' })} icon={IconDotsVertical} size={24} />

        {#if $query.post.space?.meAsMember}
          <MenuItem href={`/editor/${$query.post.permalink}`} type="link">수정하기</MenuItem>
          <MenuItem on:click={() => (openDeletePostWarning = true)}>삭제하기</MenuItem>
        {:else}
          <MenuItem
            on:click={async () => {
              if (!$query.post.space) return;

              if ($query.post.space.muted) {
                await unmuteSpace({ spaceId: $query.post.space.id });
                mixpanel.track('space:unmute', { spaceId: $query.post.space.id, via: 'post' });
              } else {
                if (!$query.me) {
                  loginRequireOpen = true;
                  return;
                }

                await muteSpace({ spaceId: $query.post.space.id });
                mixpanel.track('space:mute', { spaceId: $query.post.space.id, via: 'post' });
              }
            }}
          >
            {#if $query.post.space?.muted}
              스페이스 숨기기 해제
            {:else}
              스페이스 숨기기
            {/if}
          </MenuItem>
        {/if}
      </Menu>
    </div>

    <div
      class={flex({
        justify: 'space-between',
        borderYWidth: '1px',
        borderYColor: 'gray.100',
        marginTop: '16px',
        paddingY: '12px',
        truncate: true,
      })}
    >
      <div class={flex({ gap: '18px' })}>
        {#if $query.post.space && $query.post.member}
          <a class={css({ position: 'relative', flex: 'none', size: '36px' })} href={`/${$query.post.space.slug}`}>
            <Image
              style={css.raw({ borderWidth: '1px', borderColor: 'gray.200', borderRadius: '5px', size: '36px' })}
              $image={$query.post.space.icon}
            />
            <Avatar
              style={css.raw({
                position: 'absolute',
                right: '-8px',
                bottom: '-6px',
                borderWidth: '1px',
                borderColor: 'gray.200',
                size: '26px',
              })}
              $profile={$query.post.member.profile}
            />
          </a>
        {:else}
          <div class={css({ position: 'relative', size: '36px' })}>
            <div class={css({ borderWidth: '1px', borderColor: 'gray.200', borderRadius: '4px', size: '36px' })} />
            <div
              class={css({
                position: 'absolute',
                right: '-4px',
                bottom: '-4px',
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: 'full',
                backgroundColor: 'gray.5',
                size: '24px',
              })}
            />
          </div>
        {/if}

        <div class={flex({ direction: 'column', gap: '2px', truncate: true })}>
          <a
            class={flex({ align: 'center', gap: '4px', wrap: 'wrap', truncate: true })}
            href={`/${$query.post.space?.slug}`}
          >
            <span class={css({ fontSize: '15px', fontWeight: 'medium', truncate: true })}>
              {$query.post.space?.name ?? '스페이스'}
            </span>
            <span class={css({ fontSize: '12px', fontWeight: 'medium', color: 'gray.500' })}>
              by {$query.post.member?.profile.name ?? '작성자'}
            </span>
          </a>

          <div class={flex({ align: 'center', fontSize: '11px', color: 'gray.500' })}>
            <time>
              {dayjs($query.post.publishedAt ?? $postRevision.createdAt).formatAsDate()}
            </time>
            {#if $query.post.discloseStats}
              <div
                class={flex({
                  align: 'center',
                  _before: { content: '""', marginX: '8px', width: '1px', height: '12px', backgroundColor: 'gray.200' },
                })}
              >
                <div class={flex({ align: 'center', gap: '2px', marginRight: '10px' })}>
                  <Icon style={css.raw({ color: 'gray.400' })} icon={IconEye} />
                  {humanizeNumber($query.post.viewCount)}
                </div>
                <div class={flex({ align: 'center', gap: '2px' })}>
                  <Icon style={css.raw({ size: '15px', color: 'gray.400' })} icon={IconMoodSmile} />
                  {humanizeNumber($query.post.reactionCount)}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class={flex({ align: 'center', gap: '12px', hideBelow: 'sm' })}>
        <SharePostPopover href={shortLink}>
          <Icon
            style={css.raw({ color: { base: 'gray.500', _hover: 'teal.400' }, transition: 'common' })}
            icon={IconShare2}
            size={24}
          />
        </SharePostPopover>

        <button
          type="button"
          on:click={async () => {
            if ($query.post.bookmarkGroups.length > 0) {
              await unbookmarkPost({ bookmarkGroupId: $query.post.bookmarkGroups[0].id, postId: $query.post.id });
              mixpanel.track('post:unbookmark', { postId: $query.post.id, via: 'post' });
            } else {
              if (!$query.me) {
                loginRequireOpen = true;
                return;
              }

              await bookmarkPost({ postId: $query.post.id });
              mixpanel.track('post:bookmark', { postId: $query.post.id, via: 'post' });
            }
          }}
        >
          {#if $query.post.bookmarkGroups.length > 0}
            <Icon style={css.raw({ color: 'teal.500' })} icon={IconBookmarkFilled} size={24} />
          {:else}
            <Icon
              style={css.raw({ color: { base: 'gray.500', _hover: 'teal.400' }, transition: 'common' })}
              icon={IconBookmark}
              size={24}
            />
          {/if}
        </button>

        <Menu placement="bottom-end">
          <Icon slot="value" style={css.raw({ color: 'gray.500' })} icon={IconDotsVertical} size={24} />

          {#if $query.post.space?.meAsMember}
            <MenuItem href={`/editor/${$query.post.permalink}`} type="link">수정하기</MenuItem>
            <MenuItem on:click={() => (openDeletePostWarning = true)}>삭제하기</MenuItem>
          {:else}
            <MenuItem
              on:click={async () => {
                if (!$query.post.space) return;

                if ($query.post.space.muted) {
                  await unmuteSpace({ spaceId: $query.post.space.id });
                  mixpanel.track('space:unmute', { spaceId: $query.post.space.id, via: 'post' });
                } else {
                  if (!$query.me) {
                    loginRequireOpen = true;
                    return;
                  }

                  await muteSpace({ spaceId: $query.post.space.id });
                  mixpanel.track('space:mute', { spaceId: $query.post.space.id, via: 'post' });
                }
              }}
            >
              {#if $query.post.space?.muted}
                스페이스 숨기기 해제
              {:else}
                스페이스 숨기기
              {/if}
            </MenuItem>
          {/if}
        </Menu>
      </div>
    </div>

    {#if !$query.post.hasPassword || $query.post.space?.meAsMember || $query.post.unlocked}
      <div>
        {#if $query.post.space?.myMasquerade?.blocked}
          <AlertText
            description="{$query.post.space.name}의 게시물을 볼 수 없어요"
            icon={IconAlertTriangle}
            title="차단당했습니다"
          />
        {:else if blurContent}
          {#if $query.post.ageRating === 'ALL'}
            <AlertText
              description="해당 포스트에는 민감한 내용이 포함되어 있어요"
              icon={IconAlertSquareRounded}
              title="트리거 주의"
              {triggerTags}
            >
              <Button
                style={css.raw({ marginTop: '16px', width: '158px', fontSize: '14px', fontWeight: 'semibold' })}
                size="md"
                variant="gray-outline"
                on:click={() => (blurContent = false)}
              >
                표시
              </Button>
            </AlertText>
          {:else if $query.post.ageRating === 'R15'}
            <AlertText
              description={$query.me
                ? $query.me.personalIdentity
                  ? ''
                  : '해당 내용을 감상하려면 본인 인증이 필요해요'
                : '해당 내용을 감상하려면 본인 인증이 필요해요 로그인 후 이용해주세요'}
              icon={IconRating15Plus}
              title="15세 콘텐츠"
              {triggerTags}
            >
              <Button
                style={css.raw({ marginTop: '16px', width: '158px', fontSize: '14px', fontWeight: 'semibold' })}
                size="sm"
                variant="gray-outline"
                on:click={async () => {
                  if (!$query.me) {
                    await goto('/login');
                    return;
                  }

                  if (!$query.me.personalIdentity) {
                    await goto('/me/settings');
                    return;
                  }

                  blurContent = false;
                }}
              >
                {$query.me ? ($query.me.personalIdentity ? '표시' : '본인 인증') : '로그인 및 본인 인증'}
              </Button>
            </AlertText>
          {:else if $query.post.ageRating === 'R19'}
            <AlertText
              description={$query.me
                ? $query.me.personalIdentity
                  ? $query.me.isAdulthood
                    ? ''
                    : '해당 내용은 20세 이상만 열람할 수 있어요'
                  : '해당 내용을 감상하려면 본인 인증이 필요해요'
                : '해당 내용을 감상하려면 본인 인증이 필요해요. 로그인 후 이용해주세요'}
              icon={IconRating20Plus}
              title="성인용 콘텐츠"
              {triggerTags}
            >
              <Button
                style={css.raw({ marginTop: '16px', width: '158px', fontSize: '14px', fontWeight: 'semibold' })}
                size="sm"
                variant="gray-outline"
                on:click={async () => {
                  if (!$query.me) {
                    await goto('/login');
                    return;
                  }

                  if (!$query.me.personalIdentity) {
                    await goto('/me/settings');
                    return;
                  }

                  if (!$query.me.isAdulthood) {
                    history.back();
                  }

                  blurContent = false;
                }}
              >
                {$query.me
                  ? $query.me.personalIdentity
                    ? $query.me.isAdulthood
                      ? '표시'
                      : '돌아가기'
                    : '본인 인증'
                  : '로그인 및 본인 인증'}
              </Button>
            </AlertText>
          {/if}
        {:else}
          {#key stringify($postRevision.content)}
            <TiptapRenderer
              style={css.raw({ paddingTop: '16px', paddingBottom: '24px' })}
              content={$postRevision.content}
              options={{
                paragraphIndent: $postRevision.paragraphIndent,
                paragraphSpacing: $postRevision.paragraphSpacing,
                protectContent: $query.post.protectContent,
              }}
              bind:editor
            />
          {/key}

          <div class={flex({ justify: 'space-between', marginY: '48px' })}>
            <dl class={flex({ direction: 'column', gap: '4px' })}>
              <div class={flex()}>
                <dt class={css({ marginRight: '4px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
                  카테고리
                </dt>
                <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                  #{categoryFilter[$query.post.category]}
                </dd>
              </div>

              {#if $query.post.pairs.length > 0}
                <div class={flex({ gap: '2px', wrap: 'wrap' })}>
                  <dt class={css({ marginRight: '2px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
                    페어
                  </dt>
                  {#each $query.post.pairs as pair (pair)}
                    <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                      #{pairFilter[pair]}
                    </dd>
                  {/each}
                </div>
              {/if}

              <div class={flex({ gap: '2px', wrap: 'wrap' })}>
                {#if $query.post.tags.some(({ kind }) => kind === 'TITLE')}
                  <dt class={css({ marginRight: '2px', fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
                    작품
                  </dt>
                  {#each $query.post.tags as { tag, kind } (tag.id)}
                    {#if kind === 'TITLE'}
                      <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                        <a href={`/tag/${tag.name}`}>#{tag.name}</a>
                      </dd>
                    {/if}
                  {/each}
                {/if}

                {#if $query.post.tags.some(({ kind }) => kind === 'CHARACTER')}
                  <dt
                    class={flex({
                      marginRight: '2px',
                      fontSize: '13px',
                      fontWeight: 'medium',
                      color: 'gray.500',
                      _before: {
                        content: '""',
                        marginX: '8px',
                        marginY: 'auto',
                        width: '1px',
                        height: '10px',
                        backgroundColor: 'gray.200',
                      },
                      _firstOfType: {
                        _before: {
                          display: 'none',
                        },
                      },
                    })}
                  >
                    캐릭터
                  </dt>
                  {#each $query.post.tags as { tag, kind } (tag.id)}
                    {#if kind === 'CHARACTER'}
                      <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                        <a href={`/tag/${tag.name}`}>#{tag.name}</a>
                      </dd>
                    {/if}
                  {/each}
                {/if}

                {#if $query.post.tags.some(({ kind }) => kind === 'COUPLING')}
                  <dt
                    class={flex({
                      marginRight: '2px',
                      fontSize: '13px',
                      fontWeight: 'medium',
                      color: 'gray.500',
                      _before: {
                        content: '""',
                        marginX: '8px',
                        marginY: 'auto',
                        width: '1px',
                        height: '10px',
                        backgroundColor: 'gray.200',
                      },
                      _firstOfType: {
                        _before: {
                          display: 'none',
                        },
                      },
                    })}
                  >
                    커플링
                  </dt>
                  {#each $query.post.tags as { tag, kind } (tag.id)}
                    {#if kind === 'COUPLING'}
                      <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                        <a href={`/tag/${tag.name}`}>#{tag.name}</a>
                      </dd>
                    {/if}
                  {/each}
                {/if}

                {#if $query.post.tags.some(({ kind }) => kind === 'TRIGGER')}
                  <dt
                    class={flex({
                      marginRight: '2px',
                      fontSize: '13px',
                      fontWeight: 'medium',
                      color: 'gray.500',
                      _before: {
                        content: '""',
                        marginX: '8px',
                        marginY: 'auto',
                        width: '1px',
                        height: '10px',
                        backgroundColor: 'gray.200',
                      },
                      _firstOfType: {
                        _before: {
                          display: 'none',
                        },
                      },
                    })}
                  >
                    트리거
                  </dt>
                  {#each $query.post.tags as { tag, kind } (tag.id)}
                    {#if kind === 'TRIGGER'}
                      <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                        <a href={`/tag/${tag.name}`}>#{tag.name}</a>
                      </dd>
                    {/if}
                  {/each}
                {/if}

                {#if $query.post.tags.some(({ kind }) => kind === 'EXTRA')}
                  <dt
                    class={flex({
                      marginRight: '2px',
                      fontSize: '13px',
                      fontWeight: 'medium',
                      color: 'gray.500',
                      _before: {
                        content: '""',
                        marginX: '8px',
                        marginY: 'auto',
                        width: '1px',
                        height: '10px',
                        backgroundColor: 'gray.200',
                      },
                      _firstOfType: {
                        _before: {
                          display: 'none',
                        },
                      },
                    })}
                  >
                    추가태그
                  </dt>
                  {#each $query.post.tags as { tag, kind } (tag.id)}
                    {#if kind === 'EXTRA'}
                      <dd class={css({ fontSize: '13px', color: 'gray.400', textDecorationLine: 'underline' })}>
                        <a href={`/tag/${tag.name}`}>#{tag.name}</a>
                      </dd>
                    {/if}
                  {/each}
                {/if}
              </div>
            </dl>
            {#if $query.post.space?.meAsMember}
              <Button
                style={css.raw({ flex: 'none', alignSelf: 'flex-end' })}
                size="xs"
                variant="gray-outline"
                on:click={() => (openTagManageModal = true)}
              >
                태그수정
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <AlertText description="해당 내용은 비밀번호 입력이 필요해요" icon={IconLockSquareRounded} title="비밀글">
        <form
          class={flex({ gap: '7px', marginTop: '20px' })}
          on:submit|preventDefault={async () => {
            try {
              await unlockPasswordedPost({
                postId: $query.post.id,
                password,
              });
              mixpanel.track('post:unlock', { postId: $query.post.id });
            } catch (err) {
              if (err instanceof FormValidationError) toast.error(err.message);
            }
          }}
        >
          <input
            class={css({
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '4px',
              paddingX: '10px',
              paddingY: '6px',
              width: '274px',
              fontSize: '14px',
              backgroundColor: 'gray.50',
            })}
            placeholder="비밀번호를 입력해주세요"
            type="password"
            bind:value={password}
          />
          <Button style={css.raw({ fontSize: '14px', fontWeight: 'semibold' })} size="sm" type="submit">입력</Button>
        </form>
      </AlertText>
    {/if}

    <div
      class={flex({
        position: 'sticky',
        bottom: '0',
        justify: 'space-between',
        align: 'center',
        grow: '1',
        borderTopWidth: '1px',
        borderTopColor: 'gray.150',
        marginX: '-20px',
        paddingX: '20px',
        backgroundColor: 'gray.5',
        zIndex: '1',
        height: '56px',
        hideFrom: 'sm',
      })}
    >
      <div class={flex({ align: 'center', flexGrow: '1', height: '34px' })}>
        {#if $query.post.commentQualification === 'NONE'}
          <Tooltip
            style={center.raw({ marginRight: '8px', size: '34px' })}
            message="해당 게시물은 댓글이 허용되어 있지 않아요"
            offset={10}
            placement="top"
          >
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconMessageCircleOff} size={24} />
          </Tooltip>
        {:else}
          <a class={center({ marginRight: '8px', size: '34px' })} href="#comment">
            <Icon icon={IconMessageCircle} size={24} />
            {#if $query.post.commentCount > 0}
              <span class={css({ marginLeft: '4px', fontSize: '13px', fontWeight: 'medium' })}>
                {$query.post.commentCount}
              </span>
            {/if}
          </a>
        {/if}

        <Tooltip
          style={flex.raw({ align: 'center', height: 'full' })}
          enabled={!$query.post.receiveFeedback}
          message="피드백 받기를 설정하지 않은 포스트예요"
          offset={10}
          placement="top"
        >
          <EmojiPicker
            style={css.raw({
              backgroundColor: 'gray.50',
              width: 'fit',
              padding: '5px',
              borderRadius: '4px',
              height: 'full',
            })}
            {$query}
            disabled={!$query.post.receiveFeedback}
          >
            {#each $query.post.reactions.slice(0, 3) as reaction (reaction.id)}
              <em-emoji
                id={reaction.emoji}
                class={center({
                  'size': '24px',
                  '& img': { display: '[block!]' },
                })}
                set="twitter"
              />
            {/each}
            {#if $query.post.reactions.length > 3}
              <span class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
                ..+{$query.post.reactions.length - 3}
              </span>
            {/if}
          </EmojiPicker>
        </Tooltip>
      </div>

      <div class={flex({ align: 'center', gap: '10px' })}>
        <button
          class={center({ size: '34px' })}
          type="button"
          on:click={async () => {
            if ($query.post.bookmarkGroups.length > 0) {
              await unbookmarkPost({ bookmarkGroupId: $query.post.bookmarkGroups[0].id, postId: $query.post.id });
              mixpanel.track('post:unbookmark', { postId: $query.post.id, via: 'post' });
            } else {
              if (!$query.me) {
                loginRequireOpen = true;
                return;
              }

              await bookmarkPost({ postId: $query.post.id });
              mixpanel.track('post:bookmark', { postId: $query.post.id, via: 'post' });
            }
          }}
        >
          {#if $query.post.bookmarkGroups.length > 0}
            <Icon style={css.raw({ color: 'teal.500' })} icon={IconBookmarkFilled} size={24} />
          {:else}
            <Icon
              style={css.raw({ color: { _hover: 'teal.400' }, transition: 'common' })}
              icon={IconBookmark}
              size={24}
            />
          {/if}
        </button>
        <SharePostPopover style={center.raw({ size: '34px' })} href={shortLink}>
          <Icon style={css.raw({ color: { _hover: 'teal.400' }, transition: 'common' })} icon={IconShare2} size={24} />
        </SharePostPopover>
      </div>
    </div>

    <div
      class={flex({
        justify: 'space-between',
        borderTopWidth: '1px',
        borderTopColor: 'gray.150',
        paddingY: '18px',
        hideBelow: 'sm',
      })}
    >
      <div class={flex({ align: 'center', gap: '10px', wrap: 'wrap' })}>
        <Tooltip
          enabled={!$query.post.receiveFeedback}
          message="피드백 받기를 설정하지 않은 포스트예요"
          placement="top"
        >
          <EmojiPicker {$query} disabled={!$query.post.receiveFeedback} />
        </Tooltip>

        {#each $query.post.reactions.slice(0, 30) as reaction (reaction.id)}
          <Emoji emoji={reaction.emoji} mine={reaction.mine} postId={$query.post.id} />
        {/each}
        {#if $query.post.reactions.length > 30}
          {#if !emojiOpen}
            <button
              class={css({
                borderRadius: 'full',
                padding: '4px',
                fontSize: '12px',
                fontWeight: 'medium',
                backgroundColor: { base: 'gray.50', _hover: 'gray.200' },
                transition: 'common',
              })}
              type="button"
              on:click={() => (emojiOpen = true)}
            >
              + {$query.post.reactions.length - 30}
            </button>
          {:else}
            {#each $query.post.reactions.slice(30) as reaction (reaction.id)}
              <Emoji emoji={reaction.emoji} mine={reaction.mine} postId={$query.post.id} />
            {/each}
          {/if}
        {/if}
      </div>
      <SharePostPopover href={shortLink}>
        <Icon
          style={css.raw({ color: { base: 'gray.500', _hover: 'teal.400' }, transition: 'common' })}
          icon={IconShare2}
          size={20}
        />
      </SharePostPopover>
    </div>

    {#if $query.post.collection}
      {@const positionInCollection = $query.post.collection.posts.findIndex((post) => post.id === $query.post.id)}
      <div class={css({ borderRadius: '10px', padding: '20px', backgroundColor: 'gray.50' })}>
        <a class={flex({ gap: '12px' })} href={`/${$query.post.space?.slug}/collections/${$query.post.collection.id}`}>
          {#if $query.post.collection.thumbnail}
            <Image
              style={css.raw({ flex: 'none', borderRadius: '4px', width: '60px', height: '84px', objectFit: 'cover' })}
              $image={$query.post.collection.thumbnail}
            />
          {/if}

          <div class={css({ truncate: true })}>
            <p class={css({ fontSize: '11px', color: 'gray.500' })}>컬렉션</p>
            <p class={css({ marginBottom: '8px', fontSize: '18px', fontWeight: 'semibold', truncate: true })}>
              {$query.post.collection.name}
            </p>
            <p class={css({ fontSize: '13px', color: 'gray.500', truncate: true })}>
              총 {$query.post.collection.count}개의 포스트
            </p>
          </div>
        </a>

        {#if positionInCollection > -1}
          <div class={css({ marginTop: '16px', backgroundColor: 'gray.5' })}>
            {#if positionInCollection > 0}
              {@const previousPost = $query.post.collection.posts[positionInCollection - 1]}
              <a
                class={flex({
                  align: 'center',
                  gap: '32px',
                  padding: '16px',
                  height: '86px',
                  transition: 'common',
                  truncate: true,
                  _hover: { backgroundColor: 'gray.100' },
                })}
                href={`/${$query.post.space?.slug}/${previousPost.permalink}`}
              >
                <span class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>이전글</span>

                <div class={css({ truncate: true })}>
                  <p class={css({ fontWeight: 'semibold', truncate: true })}>
                    {previousPost.publishedRevision?.title ?? '(제목 없음)'}
                  </p>
                  {#if previousPost.publishedRevision?.subtitle}
                    <p class={css({ fontSize: '13px', color: 'gray.500', truncate: true })}>
                      {previousPost.publishedRevision.subtitle}
                    </p>
                  {/if}
                </div>
              </a>
            {/if}
            {#if positionInCollection < $query.post.collection.posts.length - 1}
              {@const nextPost = $query.post.collection.posts[positionInCollection + 1]}
              <a
                class={flex({
                  align: 'center',
                  gap: '32px',
                  padding: '16px',
                  height: '86px',
                  transition: 'common',
                  truncate: true,
                  _hover: { backgroundColor: 'gray.100' },
                })}
                href={`/${$query.post.space?.slug}/${nextPost.permalink}`}
              >
                <span class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>다음글</span>

                <div class={css({ truncate: true })}>
                  <p class={css({ fontWeight: 'semibold', truncate: true })}>
                    {nextPost.publishedRevision?.title ?? '(제목 없음)'}
                  </p>
                  {#if nextPost.publishedRevision?.subtitle}
                    <p class={css({ fontSize: '13px', color: 'gray.500', truncate: true })}>
                      {nextPost.publishedRevision.subtitle}
                    </p>
                  {/if}
                </div>
              </a>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      {#if $query.post.previousPost}
        <a
          class={flex({
            align: 'center',
            gap: '32px',
            marginTop: '12px',
            padding: '20px',
            height: '82px',
            transition: 'common',
            truncate: true,
            _hover: { backgroundColor: 'gray.100' },
          })}
          href={`/${$query.post.space?.slug}/${$query.post.previousPost.permalink}`}
        >
          <span class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>이전글</span>

          <div class={css({ truncate: true })}>
            <p class={css({ fontWeight: 'semibold', truncate: true })}>
              {$query.post.previousPost.publishedRevision.title ?? '(제목 없음)'}
            </p>
            {#if $query.post.previousPost.publishedRevision.subtitle}
              <p class={css({ fontSize: '13px', color: 'gray.500', truncate: true })}>
                {$query.post.previousPost.publishedRevision.subtitle}
              </p>
            {/if}
          </div>
        </a>
      {/if}
      {#if $query.post.nextPost}
        <a
          class={flex({
            align: 'center',
            gap: '32px',
            borderTopWidth: '1px',
            borderTopColor: 'gray.100',
            padding: '20px',
            height: '82px',
            transition: 'common',
            truncate: true,
            _hover: { backgroundColor: 'gray.100' },
          })}
          href={`/${$query.post.space?.slug}/${$query.post.nextPost.permalink}`}
        >
          <span class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>다음글</span>

          <div class={css({ truncate: true })}>
            <p class={css({ fontWeight: 'semibold', truncate: true })}>
              {$query.post.nextPost.publishedRevision.title ?? '(제목 없음)'}
            </p>
            {#if $query.post.nextPost.publishedRevision.subtitle}
              <p class={css({ fontSize: '13px', color: 'gray.500', truncate: true })}>
                {$query.post.nextPost.publishedRevision.subtitle}
              </p>
            {/if}
          </div>
        </a>
      {/if}
    {/if}

    <aside
      class={flex({
        gap: '12px',
        borderRadius: '10px',
        marginY: '16px',
        padding: '20px',
        backgroundColor: 'gray.50',
        sm: { justifyContent: 'space-between', alignItems: 'center' },
        smDown: { flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
      })}
    >
      <div
        class={flex({
          gap: '12px',
          smDown: { flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
        })}
      >
        <a class={css({ flex: 'none' })} href={`/${$query.post.space?.slug}`}>
          {#if $query.post.space}
            <Image
              style={css.raw({ borderWidth: '1px', borderColor: 'gray.200', borderRadius: '4px', size: '64px' })}
              $image={$query.post.space.icon}
            />
          {:else}
            <div class={css({ borderWidth: '1px', borderColor: 'gray.200', borderRadius: '4px', size: '64px' })} />
          {/if}
        </a>

        <article class={css({ flexGrow: '1', truncate: true })}>
          <a class={css({ width: 'full', truncate: true })} href={`/${$query.post.space?.slug}`}>
            <p
              class={css({
                width: 'full',
                fontSize: '18px',
                fontWeight: 'semibold',
                truncate: true,
                smDown: { textAlign: 'center' },
              })}
            >
              {#if $query.post.space}
                {$query.post.space.name}
              {:else}
                스페이스 이름
              {/if}
            </p>
          </a>
          <a class={css({ width: 'full', whiteSpace: 'pre-wrap' })} href={`/${$query.post.space?.slug}`}>
            <p
              class={css({
                marginTop: '4px',
                width: 'full',
                fontSize: '13px',
                color: 'gray.500',
                wordBreak: 'break-all',
                smDown: { textAlign: 'center' },
              })}
            >
              {$query.post.space?.description ?? '아직 소개가 없어요'}
            </p>
          </a>
        </article>
      </div>

      {#if !$query.post.space?.meAsMember}
        {#if $query.post.space?.followed}
          <Button
            style={flex.raw({ align: 'center', gap: '4px', flex: 'none' })}
            size="sm"
            variant="gray-outline"
            on:click={async () => {
              if (!$query.post.space) return;

              await unfollowSpace({ spaceId: $query.post.space.id });
              mixpanel.track('space:unfollow', { spaceId: $query.post.space.id, via: 'post' });
            }}
          >
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconCheck} />
            관심 스페이스
          </Button>
        {:else}
          <Button
            style={flex.raw({ align: 'center', gap: '4px', flex: 'none' })}
            size="sm"
            on:click={async () => {
              if (!$query.post.space) return;

              if (!$query.me) {
                loginRequireOpen = true;
                return;
              }

              await followSpace({ spaceId: $query.post.space.id });
              mixpanel.track('space:follow', { spaceId: $query.post.space.id, via: 'post' });
            }}
          >
            <Icon icon={IconPlus} />
            관심 스페이스
          </Button>
        {/if}
      {/if}
    </aside>

    {#if $query.post.space && !blurContent && !$query.post.space.myMasquerade?.blocked}
      <div class={css({ marginTop: '40px' })}>
        {#if $query.post.commentQualification !== 'NONE'}
          <p
            id="comment"
            class={css({
              marginBottom: '10px',
              fontSize: '18px',
              fontWeight: 'semibold',
              color: 'gray.600',
              scrollMarginY: '61px',
            })}
          >
            댓글 {comma($query.post.commentCount)}
          </p>
          <hr class={css({ marginY: '8px', height: '1px', backgroundColor: 'gray.100' })} />
          <CommentInput {$query} />

          <ul class={css({ marginTop: '24px' })}>
            {#each postComments as comment (comment.id)}
              <Comment $postComment={comment} {$query} />
            {/each}
            {#if take * (page - 1) < $query.post.paginationCount}
              <li class={css({ textAlign: 'center' })}>
                <button
                  type="button"
                  on:click={async () => {
                    fetchComments();
                  }}
                >
                  더보기
                </button>
              </li>
            {/if}
          </ul>
        {:else}
          <p
            class={css({
              borderTopWidth: '1px',
              borderTopColor: 'gray.200',
              paddingX: '20px',
              paddingY: '24px',
              fontSize: '15px',
              color: 'gray.400',
            })}
          >
            해당 게시물은 댓글이 허용되어 있지 않아요
          </p>
        {/if}
      </div>
    {/if}

    {#if $query.post.recommendedPosts.length > 0}
      <div class={css({ marginTop: '42px' })}>
        <p
          class={css({
            marginBottom: '8px',
            fontSize: '18px',
            fontWeight: 'semibold',
            sm: { marginBottom: '16px', marginX: '20px', fontSize: '20px' },
          })}
        >
          추천 포스트
        </p>

        <ul class={css({ flexGrow: '1' })}>
          {#each $query.post.recommendedPosts as post, index (post.id)}
            {#if index !== 0}
              <hr class={css({ backgroundColor: 'gray.100', sm: { marginY: '16px' } })} />
            {/if}
            <li class={css({ borderRadius: '10px', sm: { _hover: { backgroundColor: 'gray.50' } } })}>
              <a
                class={flex({ direction: 'column', paddingY: '24px', sm: { padding: '20px' } })}
                href={`/${post.space.slug}/${post.permalink}`}
              >
                <div class={flex()}>
                  <div class={css({ marginRight: { base: '14px', sm: '20px' }, width: { base: '96px', sm: '124px' } })}>
                    {#if post.thumbnail}
                      <Image
                        style={css.raw({ flex: 'none', borderRadius: '6px', size: { base: '96px', sm: '124px' } })}
                        $image={post.thumbnail}
                      />
                    {:else}
                      <div class={css({ flex: 'none', borderRadius: '6px', size: { base: '96px', sm: '124px' } })}>
                        <svg
                          class={css({ borderRadius: '6px' })}
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect fill="#0c0a091a" height="24" width="24" />
                          <path
                            d="M7.36 3.86c2.3 5.04.42 10.01-.1 11.36-.08.23-.13.36-.11.36a15.7 15.7 0 0 1 9.45 4.6l-1.58-2.74L13 14.07a1.1 1.1 0 1 1 .53-.35l3.53 6.11c-1.4-4.68.63-10.12.63-10.12-6.15-.67-10.33-5.85-10.33-5.85Z"
                            fill="#FAFAF9"
                          />
                        </svg>
                      </div>
                    {/if}

                    <div class={flex({ align: 'center', marginTop: '4px', truncate: true })}>
                      <div class={css({ position: 'relative', flex: 'none', marginRight: '8px', hideBelow: 'sm' })}>
                        <Image
                          style={css.raw({
                            borderWidth: '1px',
                            borderColor: 'gray.100',
                            borderRadius: '4px',
                            size: '22px',
                          })}
                          $image={post.space.icon}
                        />

                        <Avatar
                          style={css.raw({
                            position: 'absolute',
                            right: '-6px',
                            bottom: '-6px',
                            borderWidth: '1px',
                            borderColor: 'gray.100',
                            size: '18px',
                          })}
                          $profile={post.member.profile}
                        />
                      </div>
                      <div class={css({ truncate: true })}>
                        <p class={css({ fontSize: '12px', fontWeight: 'medium', color: 'gray.600', truncate: true })}>
                          {post.space.name}
                        </p>
                        <p class={css({ fontSize: '11px', color: 'gray.400', truncate: true })}>
                          by {post.member.profile.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class={flex({ direction: 'column', justify: 'space-between', grow: '1', truncate: true })}>
                    <div class={css({ truncate: true })}>
                      <div class={flex({ align: 'center', gap: '10px', truncate: true })}>
                        {#if post.publishedRevision?.price}
                          <Badge style={css.raw({ width: 'fit' })} color="purple">유료</Badge>
                        {/if}
                        {#if post.ageRating === 'R19'}
                          <Badge style={css.raw({ width: 'fit' })} color="red">성인</Badge>
                        {/if}
                        {#if post.ageRating === 'R15'}
                          <Badge style={css.raw({ width: 'fit' })} color="red">15세</Badge>
                        {/if}
                        {#if post.tags.some(({ kind }) => kind === 'TRIGGER')}
                          <Badge style={css.raw({ width: 'fit' })} color="orange">트리거주의</Badge>
                        {/if}
                        {#if post.hasPassword}
                          <Badge style={css.raw({ width: 'fit' })} color="gray">비밀글</Badge>
                        {/if}

                        <p
                          class={css({
                            fontWeight: 'semibold',
                            color: 'gray.600',
                            truncate: true,
                            sm: { fontSize: '18px' },
                          })}
                        >
                          {post.publishedRevision.title ?? '(제목 없음)'}
                        </p>
                      </div>

                      {#if post.publishedRevision.subtitle}
                        <p
                          class={css({
                            marginTop: { base: '1px', sm: '2px' },
                            fontSize: { base: '12px', sm: '15px' },
                            fontWeight: 'medium',
                            color: 'gray.600',
                            truncate: true,
                          })}
                        >
                          {post.publishedRevision.subtitle}
                        </p>
                      {/if}

                      <p
                        class={css({
                          marginTop: { base: '7px', sm: '12px' },
                          fontSize: { base: '12px', sm: '14px' },
                          color: 'gray.500',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          lineClamp: 3,
                        })}
                      >
                        {post.publishedRevision.previewText}
                      </p>
                    </div>

                    <ul class={flex({ align: 'center', gap: '6px', wrap: 'wrap' })}>
                      {#each post.tags as { tag, kind } (tag.id)}
                        <li
                          class={css(
                            { padding: '2px', fontSize: '12px', color: 'gray.400', textDecorationLine: 'underline' },
                            kind === 'TITLE' && { backgroundColor: 'gray.100' },
                          )}
                        >
                          #{tag.name}
                        </li>
                      {/each}
                    </ul>
                  </div>
                </div>

                <time class={css({ marginTop: '8px', textAlign: 'right', fontSize: '11px', color: 'gray.400' })}>
                  {dayjs(post.publishedAt).formatAsDate()}
                </time>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</article>

{#if editor}
  <SelectionBubbleMenu {editor}>
    <button type="button" on:click={() => (openShareContentModal = true)}>공유</button>
  </SelectionBubbleMenu>
{/if}

{#if editor && openShareContentModal}
  <ShareContent
    body={getTextBetween(editor.state.doc, editor.state.selection)}
    spaceName={$query.post.space?.name ?? ''}
    title={$postRevision.title ?? '(제목 없음)'}
    bind:open={openShareContentModal}
  />
{/if}

<LoginRequireModal bind:open={loginRequireOpen} />

<Modal
  actionStyle={css.raw({ gap: '6px', borderWidth: '0', paddingY: '24px', sm: { padding: '28px' } })}
  size="sm"
  titleStyle={css.raw({ fontSize: '18px', fontWeight: 'semibold' })}
  bind:open={openDeletePostWarning}
>
  <svelte:fragment slot="title">포스트를 삭제하시겠어요?</svelte:fragment>

  <p class={css({ marginTop: '4px', paddingX: { base: '24px', sm: '28px' }, fontSize: '14px', color: 'gray.600' })}>
    삭제된 글은 복구할 수 없어요
  </p>

  <svelte:fragment slot="action">
    <Button
      style={css.raw({ width: 'full' })}
      size="lg"
      variant="gray-outline"
      on:click={() => (openDeletePostWarning = false)}
    >
      취소
    </Button>
    <Button
      style={css.raw({ width: 'full' })}
      size="lg"
      on:click={async () => {
        await goto(`/${$query.post.space?.slug}`);
        await deletePost({ postId: $query.post.id });
        mixpanel.track('post:delete', { postId: $query.post.id, via: 'post' });
        toast.success('포스트를 삭제했어요');
      }}
    >
      삭제
    </Button>
  </svelte:fragment>
</Modal>

<TagManageModal $post={$query.post} bind:open={openTagManageModal} />
