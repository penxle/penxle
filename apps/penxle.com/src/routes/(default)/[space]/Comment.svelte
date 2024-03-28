<script lang="ts">
  import dayjs from 'dayjs';
  import IconReplyBar from '~icons/effit/reply-bar';
  import IconCaretDownFilled from '~icons/tabler/caret-down-filled';
  import IconCaretUpFilled from '~icons/tabler/caret-up-filled';
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import IconHeart from '~icons/tabler/heart';
  import IconHeartFilled from '~icons/tabler/heart-filled';
  import IconLock from '~icons/tabler/lock';
  import IconPinnedFilled from '~icons/tabler/pinned-filled';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Avatar, Icon } from '$lib/components';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { Button, Modal } from '$lib/components/v2';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import CommentInput from './CommentInput.svelte';
  import type { PostPage_Comment_postComment, PostPage_Comment_query } from '$glitch';

  export let editing = false;
  let repliesOpen = false;
  let replyInputOpen = false;
  let blockMasqueradeOpen = false;
  export let parentId: string | undefined = undefined;

  let _postComment: PostPage_Comment_postComment;
  let _query: PostPage_Comment_query;
  export { _postComment as $postComment, _query as $query };

  $: query = fragment(
    _query,
    graphql(`
      fragment PostPage_Comment_query on Query {
        me {
          id
        }

        post(permalink: $permalink) {
          id

          member {
            id

            profile {
              id
              name
              ...Avatar_profile
            }
          }

          space {
            id
            slug

            meAsMember {
              id
            }

            myMasquerade {
              id
            }

            commentProfile {
              id
            }
          }

          comments {
            id
            content
            pinned
            createdAt

            profile {
              id
              name
            }

            masquerade {
              id
            }

            children {
              id
            }
          }
        }

        ...CommentInput_query
      }
    `),
  );

  $: postComment = fragment(
    _postComment,
    graphql(`
      fragment PostPage_Comment_postComment on PostComment {
        id
        content
        pinned
        visibility
        createdAt
        state
        purchased
        liked
        likeCount
        likedByPostUser

        profile {
          id
          name
        }

        masquerade {
          id
        }

        children {
          id
          content
          createdAt

          profile {
            id
            name
          }

          masquerade {
            id
          }
        }
      }
    `),
  );

  const blockMasquerade = graphql(`
    mutation PostPage_Comment_BlockMasquerade_Mutation($input: BlockMasqueradeInput!) {
      blockMasquerade(input: $input) {
        id
      }
    }
  `);

  const deleteComment = graphql(`
    mutation PostPage_Comment_DeleteComment_Mutation($input: DeleteCommentInput!) {
      deleteComment(input: $input) {
        id
      }
    }
  `);

  const pinComment = graphql(`
    mutation PostPage_Comment_PinComment_Mutation($input: PinCommentInput!) {
      pinComment(input: $input) {
        id
        pinned
      }
    }
  `);

  const unpinComment = graphql(`
    mutation PostPage_Comment_UnpinComment_Mutation($input: UnpinCommentInput!) {
      unpinComment(input: $input) {
        id
        pinned
      }
    }
  `);

  const likeComment = graphql(`
    mutation PostPage_Comment_LikeComment_Mutation($input: LikeCommentInput!) {
      likeComment(input: $input) {
        id
        likeCount
        liked
        likedByPostUser
      }
    }
  `);

  const unlikeComment = graphql(`
    mutation PostPage_Comment_UnlikeComment_Mutation($input: UnlikeCommentInput!) {
      unlikeComment(input: $input) {
        id
        likeCount
        liked
        likedByPostUser
      }
    }
  `);
</script>

{#if $query.post.space}
  {#if editing}
    <CommentInput {$query} commentId={$postComment.id} content={$postComment.content} {parentId} bind:editing />
  {:else}
    <li
      class={css(
        {
          display: 'flex',
          gap: '4px',
          borderTopWidth: '1px',
          borderTopColor: 'gray.100',
          paddingX: '20px',
          paddingY: '16px',
          smDown: { marginX: '-20px' },
          _firstOfType: { borderWidth: '0' },
        },
        $postComment.pinned && { backgroundColor: 'teal.50' },
        !!parentId && { backgroundColor: 'gray.50' },
      )}
    >
      {#if parentId}
        <Icon style={css.raw({ color: 'gray.500' })} icon={IconReplyBar} />
      {/if}

      <div class={css({ flexGrow: '1' })}>
        {#if $postComment.pinned}
          <p
            class={flex({
              align: 'center',
              gap: '4px',
              marginBottom: '8px',
              fontSize: '11px',
              fontWeight: 'medium',
              color: 'gray.400',
            })}
          >
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconPinnedFilled} />
            고정된 댓글
          </p>
        {/if}

        <div class={flex({ justify: 'space-between', align: 'center', marginBottom: '8px' })}>
          {#if $query.post.member?.profile.id === $postComment.profile.id}
            <p
              class={css({
                borderRadius: '4px',
                paddingX: '10px',
                paddingY: '4px',
                fontSize: '11px',
                fontWeight: 'semibold',
                color: 'gray.5',
                backgroundColor: 'gray.400',
              })}
            >
              {$query.post.member?.profile.name}
            </p>
          {:else}
            <p class={flex({ align: 'center', gap: '4px', wrap: 'wrap', fontSize: '14px', fontWeight: 'medium' })}>
              {$postComment.profile.name}
              {#if $postComment.purchased}
                <span class={css({ fontSize: '12px', color: 'teal.500' })}>구매자</span>
              {/if}
              {#if $postComment.visibility === 'PRIVATE'}
                <Icon style={css.raw({ color: 'gray.400' })} icon={IconLock} />
              {/if}
            </p>
          {/if}

          <Menu menuStyle={css.raw({ width: '158px' })} placement="bottom-end">
            <button
              slot="value"
              class={css(
                ($postComment.state === 'INACTIVE' ||
                  (!$query.post.space.meAsMember &&
                    $postComment.profile.id !== $query.post.space.commentProfile?.id)) && { display: 'none' },
              )}
              type="button"
            >
              <Icon style={css.raw({ color: 'gray.500' })} icon={IconDotsVertical} size={20} />
            </button>

            {#if $query.post.space.meAsMember}
              <MenuItem
                on:click={async () => {
                  if ($postComment.pinned) {
                    await unpinComment({ commentId: $postComment.id });
                    mixpanel.track('comment:unpin', { commentId: $postComment.id });
                  } else {
                    await pinComment({ commentId: $postComment.id });
                    mixpanel.track('comment:pin', { commentId: $postComment.id });
                  }
                }}
              >
                {$postComment.pinned ? '고정 해제' : '고정'}
              </MenuItem>
            {/if}
            {#if $query.post.space.commentProfile?.id === $postComment.profile.id}
              <MenuItem on:click={() => (editing = true)}>수정</MenuItem>
            {/if}
            {#if $query.post.space.meAsMember && $postComment.masquerade && $postComment.profile.id !== $query.post.member?.profile.id}
              <MenuItem on:click={() => (blockMasqueradeOpen = true)}>차단</MenuItem>
            {/if}
            {#if $query.post.space.meAsMember || $query.post.space.commentProfile?.id === $postComment.profile.id}
              <MenuItem
                on:click={async () => {
                  await deleteComment({ commentId: $postComment.id });

                  if (!$postComment.masquerade || !$query.post.space) return;

                  mixpanel.track('comment:delete', {
                    masqueradeId: $postComment.masquerade.id,
                    spaceId: $query.post.space.id,
                  });
                }}
              >
                삭제
              </MenuItem>
            {/if}
          </Menu>
        </div>

        {#if $postComment.visibility === 'PRIVATE' && $query.post.space.commentProfile?.id !== $postComment.profile.id && !$query.post.space.meAsMember}
          <p class={css({ fontSize: '14px', color: 'gray.400' })}>비밀댓글이에요</p>
        {:else}
          {#if $postComment.state === 'INACTIVE'}
            <p class={css({ fontSize: '14px', color: 'gray.400' })}>삭제된 댓글이에요</p>
          {:else}
            <p class={css({ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' })}>
              {$postComment.content}
            </p>

            <div class={css({ fontSize: '10px', fontWeight: 'light', color: 'gray.400' })}>
              {dayjs($postComment.createdAt).formatAsDateTime()}
            </div>

            <div class={flex({ align: 'center', gap: '6px', marginTop: '20px', height: '34px' })}>
              <button
                class={flex({
                  align: 'center',
                  gap: '4px',
                  margin: '7px',
                  fontSize: '13px',
                  fontWeight: 'medium',
                  color: 'gray.400',
                })}
                type="button"
                on:click={async () => {
                  if ($postComment.liked) {
                    await unlikeComment({ commentId: $postComment.id });
                    mixpanel.track('comment:unlike', { postId: $query.post.id, commentId: $postComment.id });
                  } else {
                    await likeComment({ commentId: $postComment.id });
                    mixpanel.track('comment:like', { postId: $query.post.id, commentId: $postComment.id });
                  }
                }}
              >
                {#if $postComment.liked}
                  <Icon style={css.raw({ color: 'teal.500' })} icon={IconHeartFilled} />
                {:else}
                  <Icon style={css.raw({ color: 'teal.500' })} icon={IconHeart} />
                {/if}
                {#if $postComment.likeCount > 0}
                  {$postComment.likeCount}
                {/if}
              </button>

              {#if !parentId}
                <Button
                  style={css.raw({ backgroundColor: 'gray.5/60' })}
                  size="xs"
                  variant="gray-outline"
                  on:click={() => (replyInputOpen = !replyInputOpen)}
                >
                  답글
                </Button>
              {/if}

              {#if $postComment.likedByPostUser}
                <div
                  class={css({
                    position: 'relative',
                    borderRadius: 'full',
                    outlineWidth: '1px',
                    outlineColor: 'teal.500',
                    margin: '6px',
                    size: '22px',
                  })}
                >
                  {#if $query.post.member}
                    <Avatar
                      style={css.raw({ borderRadius: 'full', size: '22px' })}
                      $profile={$query.post.member.profile}
                    />
                  {/if}

                  <Icon
                    style={css.raw({
                      position: 'absolute',
                      bottom: '-6px',
                      right: '-6px',
                      color: 'teal.500',
                    })}
                    icon={IconHeartFilled}
                  />
                </div>
              {/if}
            </div>
          {/if}

          {#if !parentId && $postComment.children.length > 0}
            <button
              class={flex({
                align: 'center',
                gap: '4px',
                marginTop: '12px',
                fontSize: '12px',
                fontWeight: 'medium',
                color: 'gray.500',
              })}
              type="button"
              on:click={() => {
                repliesOpen = !repliesOpen;
                replyInputOpen = repliesOpen ? true : false;
              }}
            >
              {$postComment.children.length}개의 답글
              {#if repliesOpen}
                <Icon style={css.raw({ color: 'gray.500' })} icon={IconCaretUpFilled} size={12} />
              {:else}
                <Icon style={css.raw({ color: 'gray.500' })} icon={IconCaretDownFilled} size={12} />
              {/if}
            </button>
          {/if}
        {/if}
      </div>
    </li>
  {/if}

  {#if repliesOpen}
    {#each $postComment.children as reply (reply)}
      <svelte:self $postComment={reply} {$query} parentId={$postComment.id} />
    {/each}
  {/if}

  {#if replyInputOpen && $postComment.state !== 'INACTIVE'}
    <CommentInput {$query} parentId={$postComment.id} bind:editing={replyInputOpen} />
  {/if}

  <Modal
    actionStyle={css.raw({
      gap: '6px',
      borderWidth: '0',
      paddingTop: '28px',
      paddingBottom: '24px',
      sm: { paddingX: '28px', paddingBottom: '28px' },
    })}
    size="sm"
    titleStyle={css.raw({ fontSize: '18px', fontWeight: 'semibold' })}
    bind:open={blockMasqueradeOpen}
  >
    <svelte:fragment slot="title">{$postComment.profile.name}님을 차단할까요?</svelte:fragment>

    <div class={css({ marginTop: '4px', paddingX: { base: '24px', sm: '28px' }, fontSize: '14px', color: 'gray.600' })}>
      차단된 유저는 스페이스의 모든 게시물을 볼 수 없으며, 댓글을 달 수 없어요
      <br />
      차단 해지는 [스페이스 설정 - 독자관리]에서 가능해요
    </div>

    <svelte:fragment slot="action">
      <Button
        style={css.raw({ width: 'full' })}
        size="lg"
        variant="gray-outline"
        on:click={() => (blockMasqueradeOpen = false)}
      >
        취소
      </Button>
      <Button
        style={css.raw({ width: 'full' })}
        size="lg"
        on:click={async () => {
          if (!$postComment.masquerade || !$query.post.space) return;

          await blockMasquerade({ masqueradeId: $postComment.masquerade.id, spaceId: $query.post.space.id });
          mixpanel.track('space:masquerade:block', {
            masqueradeId: $postComment.masquerade?.id,
            spaceId: $query.post.space.id,
          });
        }}
      >
        차단
      </Button>
    </svelte:fragment>
  </Modal>
{/if}
