<script lang="ts">
  import dayjs from 'dayjs';
  import ky from 'ky';
  import IconCheck from '~icons/tabler/check';
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import IconCoin from '~icons/tabler/coin';
  import IconMessageCircle from '~icons/tabler/message-circle';
  import IconSettings from '~icons/tabler/settings';
  import { goto } from '$app/navigation';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Helmet, Icon } from '$lib/components';
  import { Button } from '$lib/components/v2';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';

  $: query = graphql(`
    query MeNotificationsPage_Query {
      me @_required {
        id

        notifications {
          __typename
          id
          category
          createdAt
          data
          state

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
    }
  `);

  const markNotificationAsRead = graphql(`
    mutation MeNotificationsPage_MarkNotificationAsRead_Mutation($input: MarkNotificationAsReadInput!) {
      markNotificationAsRead(input: $input) {
        id
        state
      }
    }
  `);

  $: unreadNotifications = $query.me.notifications.filter((notification) => notification.state === 'UNREAD');

  const readAllNotifications = () => {
    mixpanel.track('user:notification-state:read', { via: 'notifications' });
    return Promise.all(unreadNotifications.map(({ id }) => markNotificationAsRead({ notificationId: id })));
  };

  const redirect = async (notification: (typeof $query.me.notifications)[0]) => {
    if (notification.state === 'UNREAD') {
      await markNotificationAsRead({ notificationId: notification.id });
      mixpanel.track('user:notification-state:read', { via: 'notification-popup' });
    }

    const resp = await ky.get(`/api/notification/${notification.id}`);
    await goto(resp.url);
  };
</script>

<Helmet description="받은 알림 목록을 둘러보세요" title="알림" />

<header>
  <div
    class={flex({
      align: 'center',
      justify: 'space-between',
      position: 'relative',
      borderBottomWidth: '1px',
      borderColor: 'gray.100',
      paddingX: '20px',
      paddingY: '14px',
      height: '55px',
    })}
  >
    <button type="button" on:click={() => history.back()}>
      <Icon icon={IconChevronLeft} size={24} />
    </button>

    <h1 class={css({ position: 'absolute', left: '1/2', translateX: '-1/2', fontWeight: 'semibold' })}>알림</h1>

    <a href="/me/settings/notifications">
      <Icon icon={IconSettings} size={20} />
    </a>
  </div>

  <div
    class={flex({
      align: 'center',
      justify: 'space-between',
      borderBottomWidth: '1px',
      borderColor: 'gray.100',
      paddingX: '20px',
      paddingY: '14px',
      height: '55px',
    })}
  >
    <p>
      새소식 <mark class={css({ color: 'teal.500' })}>
        {unreadNotifications.length}
      </mark>
    </p>
    <Button size="xs" variant="gray-outline" on:click={async () => await readAllNotifications()}>모두 읽기</Button>
  </div>
</header>

<div class={flex({ flexDirection: 'column', flexGrow: '1', width: 'full' })}>
  <ul class={css({ marginX: 'auto', marginBottom: '28px', minHeight: '120px', width: 'full', maxWidth: '800px' })}>
    {#each $query.me.notifications as notification (notification.id)}
      <li>
        <button
          class={css(
            {
              borderBottomWidth: '1px',
              borderColor: 'gray.100',
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
              { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'gray.500' },
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
              {notification.actor?.name}님이 {notification.space.name.length > 10
                ? `${notification.space.name.slice(0, 10)}...`
                : notification.space.name} 스페이스를 구독했어요
            {:else if notification.category === 'TREND'}
              포스트 조회수가 급상승하고 있어요
            {:else if notification.__typename === 'PurchaseNotification'}
              {notification.actor?.name}님이 {notification.post.publishedRevision?.title ?? '(제목 없음)'} 포스트를 구매했어요
            {:else if notification.__typename === 'CommentNotification'}
              {notification.actor?.name}님이 {notification.post.publishedRevision?.title ?? '(제목 없음)'}에 댓글을
              달았어요
            {/if}
          </div>
          <time
            class={css({
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: 'light',
              color: 'gray.400',
              textAlign: 'right',
              width: 'full',
            })}
          >
            {dayjs(notification.createdAt).formatAsDateTime()}
          </time>
        </button>
      </li>
    {:else}
      <p class={css({ fontSize: '15px', color: 'gray.400', textAlign: 'center' })}>알림이 없어요</p>
    {/each}
  </ul>
</div>
