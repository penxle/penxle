<script lang="ts">
  import dayjs from 'dayjs';
  import ky from 'ky';
  import IconBell from '~icons/tabler/bell';
  import IconCheck from '~icons/tabler/check';
  import IconCoin from '~icons/tabler/coin';
  import IconMessageCircle from '~icons/tabler/message-circle';
  import IconX from '~icons/tabler/x';
  import { beforeNavigate, goto } from '$app/navigation';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Icon } from '$lib/components';
  import { Button } from '$lib/components/v2';
  import { createFloatingActions, portal } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';
  import { center, circle, flex } from '$styled-system/patterns';
  import type { DefaultLayout_NotificationMenu_user } from '$glitch';

  let _user: DefaultLayout_NotificationMenu_user;
  export { _user as $user };

  let open = false;

  $: user = fragment(
    _user,
    graphql(`
      fragment DefaultLayout_NotificationMenu_user on User {
        id

        profile {
          id
          name

          avatar {
            id
            ...Image_image
          }
        }

        notifications {
          __typename
          id
          category
          data
          state
          createdAt

          actor {
            id
            name
          }

          ... on SubscribeNotification {
            id

            space {
              id
              name
            }
          }

          ... on PurchaseNotification {
            id

            post {
              id

              publishedRevision {
                id
                title
              }
            }
          }

          ... on CommentNotification {
            id

            post {
              id

              publishedRevision {
                id
                title
              }
            }
          }
        }
      }
    `),
  );

  const { anchor, floating } = createFloatingActions({
    placement: 'bottom-end',
    offset: 8,
  });

  const markNotificationAsRead = graphql(`
    mutation DefaultLayout_Notification_MarkNotificationAsRead_Mutation($input: MarkNotificationAsReadInput!) {
      markNotificationAsRead(input: $input) {
        id
        state
      }
    }
  `);

  $: checkUnreadNotification = $user.notifications.find((notification) => notification.state === 'UNREAD');
  $: unreadNotifications = $user.notifications.filter((notification) => notification.state === 'UNREAD');

  const readAllNotifications = () => {
    mixpanel.track('user:notification-state:read', { via: 'notification-popup' });
    return Promise.all(unreadNotifications.map(({ id }) => markNotificationAsRead({ notificationId: id })));
  };

  const redirect = async (notification: (typeof $user.notifications)[0]) => {
    if (notification.state === 'UNREAD') {
      await markNotificationAsRead({ notificationId: notification.id });
      mixpanel.track('user:notification-state:read', { via: 'notification-popup' });
    }

    const resp = await ky.get(`/api/notification/${notification.id}`);
    await goto(resp.url);
  };

  beforeNavigate(() => {
    open = false;
  });

  const solidStyle = {
    _hover: {
      'backgroundColor': 'gray.100',
      '& path': {
        fill: '[currentColor]',
      },
    },
    _pressed: {
      'backgroundColor': 'gray.100',
      '& path': {
        fill: '[currentColor]',
      },
    },
  } as const;
</script>

<div class={center({ position: 'relative' })}>
  <a
    class={circle({
      size: '34px',
      color: 'gray.800',
      hideFrom: 'sm',
      ...solidStyle,
    })}
    href="/me/notifications"
  >
    <Icon icon={IconBell} size={24} />
  </a>

  <button
    class={circle({
      size: '36px',
      color: 'gray.800',
      transition: 'common',
      hideBelow: 'sm',
      ...solidStyle,
    })}
    aria-pressed={open}
    type="button"
    on:click={() => (open = true)}
    use:anchor
  >
    <Icon icon={IconBell} size={24} />
  </button>

  {#if checkUnreadNotification}
    <span
      class={circle({ position: 'absolute', size: '6px', top: '4px', right: '4px', backgroundColor: 'teal.500' })}
    />
  {/if}
</div>

{#if open}
  <div
    class={css({ position: 'fixed', inset: '0', zIndex: '40' })}
    role="button"
    tabindex="-1"
    on:click={() => (open = false)}
    on:keypress={null}
    use:portal
  />

  <div
    class={flex({
      direction: 'column',
      position: 'absolute',
      borderRadius: '10px',
      width: 'full',
      maxWidth: '375px',
      backgroundColor: 'gray.5',
      boxShadow: '[0px 5px 22px 0px {colors.gray.900/6}]',
      zIndex: '50',
    })}
    use:floating
  >
    <div
      class={flex({
        justify: 'space-between',
        align: 'center',
        borderBottomWidth: '1px',
        borderBottomColor: 'gray.100',
        paddingX: '16px',
        paddingY: '12px',
        height: '55px',
      })}
    >
      <p class={css({ fontSize: '16px', fontWeight: 'semibold' })}>알림</p>

      <button type="button" on:click={() => (open = false)}>
        <Icon icon={IconX} size={20} />
      </button>
    </div>

    <div
      class={flex({
        justify: 'space-between',
        align: 'center',
        borderBottomWidth: '1px',
        borderBottomColor: 'gray.100',
        paddingX: '16px',
        paddingY: '12px',
        height: '55px',
      })}
    >
      <p>
        새소식 <span class={css({ fontSize: '16px', color: 'teal.500' })}>{unreadNotifications.length}</span>
      </p>

      {#if $user.notifications.length > 0}
        <Button
          style={css.raw({ fontSize: '12px', fontWeight: 'semibold' })}
          size="sm"
          variant="outline"
          on:click={async () => await readAllNotifications()}
        >
          모두 읽기
        </Button>
      {/if}
    </div>

    <ul class={css({ minHeight: '120px', maxHeight: '440px', overflowY: 'auto' })}>
      {#each $user.notifications.slice(0, 20) as notification (notification.id)}
        <li>
          <button
            class={css(
              {
                borderBottomWidth: '1px',
                borderBottomColor: 'gray.100',
                paddingX: '16px',
                paddingY: '20px',
                width: 'full',
                transition: 'common',
                _hover: { backgroundColor: 'gray.100' },
              },
              notification.state === 'UNREAD' && { backgroundColor: 'teal.50' },
            )}
            type="button"
            on:click={() => redirect(notification)}
          >
            <div
              class={css(
                flex.raw({ align: 'center', gap: '4px', fontSize: '13px', color: 'gray.500' }),
                notification.state === 'UNREAD' && { color: 'teal.500' },
              )}
            >
              {#if notification.__typename === 'SubscribeNotification'}
                <Icon icon={IconCheck} size={12} />
                스페이스 구독
              {:else if notification.__typename === 'PurchaseNotification'}
                <Icon icon={IconCoin} size={12} />
                구매
              {:else if notification.__typename === 'CommentNotification'}
                <Icon icon={IconMessageCircle} size={12} />
                댓글
              {/if}
            </div>
            <div class={css({ paddingX: '12px', fontSize: '14px', fontWeight: 'medium', textAlign: 'left' })}>
              {#if notification.__typename === 'SubscribeNotification'}
                {notification.actor.name}님이 {notification.space.name.length > 10
                  ? `${notification.space.name.slice(0, 10)}...`
                  : notification.space.name} 스페이스를 구독했어요
              {:else if notification.category === 'TREND'}
                포스트 조회수가 급상승하고 있어요
              {:else if notification.__typename === 'PurchaseNotification'}
                {notification.actor.name}님이 {notification.post.publishedRevision?.title ?? '(제목 없음)'} 포스트를 구매했어요
              {:else if notification.__typename === 'CommentNotification'}
                {notification.actor.name}님이 {notification.post.publishedRevision?.title ?? '(제목 없음)'}에 댓글을
                달았어요
              {/if}
            </div>
            <time
              class={css({
                display: 'inline-block',
                width: 'full',
                fontSize: '10px',
                fontWeight: 'light',
                textAlign: 'right',
                color: 'gray.400',
              })}
            >
              {dayjs(notification.createdAt).formatAsDateTime()}
            </time>
          </button>
        </li>
      {:else}
        <li class={css({ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', color: 'gray.500' })}>
          알림이 없어요
        </li>
      {/each}

      {#if $user.notifications.length > 20}
        <li>
          <a
            class={css({
              display: 'inline-block',
              paddingY: '16px',
              width: 'full',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'medium',
              color: 'gray.400',
            })}
            href="/me/notifications"
          >
            더보기
          </a>
        </li>
      {/if}
    </ul>
  </div>
{/if}
