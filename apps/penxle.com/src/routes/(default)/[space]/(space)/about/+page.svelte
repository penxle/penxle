<script lang="ts">
  import dayjs from 'dayjs';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import { graphql } from '$glitch';
  import { Avatar, Chip, Helmet, Icon } from '$lib/components';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';

  $: query = graphql(`
    query SpaceAboutPage_Query($slug: String!) {
      space(slug: $slug) {
        name
        description
        createdAt
        id

        myMasquerade {
          id
          blocked
        }

        members {
          id
          role

          profile {
            id
            name
            ...Avatar_profile
          }
        }
      }
    }
  `);
</script>

<Helmet
  description={$query.space.description ?? `펜슬의 ${$query.space.name} 스페이스 소개`}
  title={`${$query.space.name} 소개`}
/>

<div
  class={flex({
    direction: 'column',
    gap: '8px',
    grow: '1',
    width: 'full',
    maxWidth: '800px',
    smDown: { backgroundColor: 'gray.100' },
  })}
>
  {#if $query.space.myMasquerade?.blocked}
    <div class={center({ flexDirection: 'column', minHeight: '176px' })}>
      <Icon icon={IconAlertTriangle} size={28} />
      <p class={css({ marginTop: '4px', marginBottom: '2px', fontSize: '18px', fontWeight: 'semibold' })}>
        차단당했습니다
      </p>
      <p class={css({ fontSize: '14px', color: 'gray.500' })}>{$query.space.name}의 게시물을 볼 수 없어요</p>
    </div>
  {:else}
    <section class={flex({ direction: 'column', gap: '12px', padding: '32px', backgroundColor: 'gray.5' })}>
      <h2 class={css({ fontSize: '18px', fontWeight: 'bold' })}>스페이스 소개</h2>
      <p class={css({ whiteSpace: 'pre-wrap' })}>
        {$query.space.description ?? '아직 스페이스 소개가 작성되지 않았어요'}
      </p>
      <p class={css({ color: 'gray.500' })}>
        스페이스 개설일 : <time datetime={$query.space.createdAt}>
          {dayjs($query.space.createdAt).formatAsDate()}
        </time>
      </p>
    </section>

    <section class={flex({ direction: 'column', gap: '12px', padding: '32px', backgroundColor: 'gray.5' })}>
      <h2
        class={css({
          fontSize: '18px',
          fontWeight: 'bold',
          _after: { content: 'attr(data-count)', marginLeft: '8px', color: 'gray.500' },
        })}
        data-count={$query.space.members.length}
      >
        스페이스 멤버
      </h2>
      <ul class={flex({ direction: 'column', gap: '12px' })}>
        {#each $query.space.members as member (member.id)}
          <li class={css({ display: 'inline-flex', alignItems: 'center', paddingY: '8px' })}>
            <Avatar style={css.raw({ marginRight: '12px', size: '24px' })} $profile={member.profile} />
            <span class={css({ fontSize: '14px', fontWeight: 'semibold', truncate: true })}>{member.profile.name}</span>
            {#if member.role === 'ADMIN'}
              <Chip style={css.raw({ marginLeft: '4px' })} color="grass">관리자</Chip>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>
