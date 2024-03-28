<script generics="T extends 'space' | 'me'" lang="ts">
  import dayjs from 'dayjs';
  import IconGlobe from '~icons/effit/globe';
  import IconLink from '~icons/effit/link';
  import IconUsers from '~icons/effit/users';
  import IconCheck from '~icons/tabler/check';
  import IconChevronDown from '~icons/tabler/chevron-down';
  import IconPlus from '~icons/tabler/plus';
  import IconTrash from '~icons/tabler/trash';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Avatar, Button, Chip, Icon, Image, Modal, Tag, Tooltip } from '$lib/components';
  import { Checkbox, Editable, Switch } from '$lib/components/forms';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { Table, TableData, TableHead, TableHeader, TableRow } from '$lib/components/table';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { ChangeEventHandler } from 'svelte/elements';
  import type {
    PostManageTable_Collection,
    PostManageTable_Post_query,
    PostManageTable_SpaceMember,
    PostVisibility,
  } from '$glitch';
  import type { PublishPostInput } from '$lib/validations/post';

  const toolbarMenuOffset = 16;

  export let type: T;
  let _posts: PostManageTable_Post_query[];
  let _spaceMember: PostManageTable_SpaceMember | null = null;
  let _collections: PostManageTable_Collection[] = [];

  type $$Props = { type: typeof type; $posts: typeof _posts } & (T extends 'space'
    ? { $spaceMember: typeof _spaceMember; $collections: typeof _collections }
    : unknown);
  export { _collections as $collections, _posts as $posts, _spaceMember as $spaceMember };

  $: posts = fragment(
    _posts,
    graphql(`
      fragment PostManageTable_Post_query on Post {
        id
        permalink
        receiveFeedback
        receiveTagContribution
        discloseStats
        visibility
        createdAt
        publishedAt

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

        collection {
          id
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
            ...Avatar_profile
          }
        }

        publishedRevision @_required {
          id
          title
          createdAt
        }
      }
    `),
  );

  $: spaceMember = fragment(
    _spaceMember,
    graphql(`
      fragment PostManageTable_SpaceMember on SpaceMember {
        id
        role
      }
    `),
  );

  $: collections = fragment(
    _collections,
    graphql(`
      fragment PostManageTable_Collection on SpaceCollection {
        id
        name
      }
    `),
  );

  function hasPermissionToUpdatePost(memberId: string) {
    if (type === 'me') return true;

    if (!$spaceMember) throw new Error('스페이스 관리 페이지에서는 "$spaceMember" prop 가 필수예요');

    return memberId === $spaceMember.id || $spaceMember.role === 'ADMIN';
  }

  let selectedPostIds = new Set<string>();
  $: selectedPostCount = selectedPostIds.size;
  $: _selectedPostIds = [...selectedPostIds.values()];

  $: selectedPosts = $posts.filter((post) => _selectedPostIds.includes(post.id));
  $: selectedOwnPosts = type === 'me' || selectedPosts.every((post) => post.member?.id === $spaceMember?.id);

  let receiveFeedback = false;
  let receiveTagContribution = false;
  let discloseStats = false;

  let openDeletePostWaring = false;
  let deletePostId: string | null = null;
  let deletePostIds: string[] | null = null;

  let createingCollection = false;
  let openCreateCollection = false;
  let selectedCollectionId: string | null = null;

  function resetPostOptions() {
    receiveFeedback = selectedPosts.every((post) => post.receiveFeedback);
    receiveTagContribution = selectedPosts.every((post) => post.receiveTagContribution);
    discloseStats = selectedPosts.every((post) => post.discloseStats);
  }

  $: if (selectedPostIds.size > 0) {
    resetPostOptions();
  }

  function resetSelectedCollectionId() {
    const baseCollectionId = selectedPosts[0].collection?.id;

    selectedCollectionId =
      baseCollectionId && selectedPosts.every((post) => post.collection?.id === baseCollectionId)
        ? baseCollectionId
        : null;
  }

  if (selectedPostIds.size > 0) {
    resetSelectedCollectionId();
  }

  const visibilityToLocaleString = {
    PUBLIC: '전체공개',
    SPACE: '멤버공개',
    UNLISTED: '링크공개',
  };

  const visibilityToIcon = {
    PUBLIC: IconGlobe,
    SPACE: IconUsers,
    UNLISTED: IconLink,
  };

  const visibilityOptions = Object.entries(visibilityToLocaleString).map(([value, label]) => ({ value, label })) as {
    value: keyof typeof visibilityToLocaleString;
    label: string;
  }[];

  const updateVisibility = graphql(`
    mutation SpaceSettingPostsPage_UpdateVisibility_Mutation($input: UpdatePostOptionsInput!) {
      updatePostOptions(input: $input) {
        id
        visibility
      }
    }
  `);

  function updateVisibilities(visibility: PostVisibility) {
    if (type === 'space') {
      mixpanel.track('space:dashboard:posts:update:visibility', { spaceId: $posts[0].space?.id });
    } else {
      mixpanel.track('me:posts:update:visibility');
    }
    return Promise.all(_selectedPostIds.map((postId) => updateVisibility({ postId, visibility })));
  }

  const updatePostOptions = graphql(`
    mutation SpaceSettingPostsPage_UpdatePostOptions_Mutation($input: UpdatePostOptionsInput!) {
      updatePostOptions(input: $input) {
        id
        receiveFeedback
        receiveTagContribution
        discloseStats
      }
    }
  `);

  function updatePostsOptions(
    input: Partial<Pick<PublishPostInput, 'receiveFeedback' | 'receiveTagContribution' | 'discloseStats'>>,
  ) {
    if (type === 'space') {
      mixpanel.track('space:dashboard:posts:update:options', { spaceId: $posts[0].space?.id });
    } else {
      mixpanel.track('me:posts:update:options');
    }
    return Promise.all(_selectedPostIds.map((postId) => updatePostOptions({ postId, ...input })));
  }

  const _deletePost = graphql(`
    mutation SpaceSettingPostsPage_DeletePost_Mutation($input: DeletePostInput!) {
      deletePost(input: $input) {
        id
      }
    }
  `);

  async function deletePost(props: { postId: string } | { postIds: string[] }) {
    const postIds = 'postId' in props ? [props.postId] : props.postIds;
    await Promise.all(postIds.map((postId) => _deletePost({ postId })));

    selectedPostIds.clear();
    selectedPostIds = selectedPostIds;

    if (type === 'space') {
      mixpanel.track('space:dashboard:posts:delete', { spaceId: $posts[0].space?.id, postIds });
    } else {
      mixpanel.track('me:posts:delete', { postIds });
    }
  }

  const handleSelectAllPost: ChangeEventHandler<HTMLInputElement> = (event) => {
    const { checked } = event.currentTarget;

    if (checked) {
      for (const post of $posts ?? []) {
        selectedPostIds.add(post.id);
      }
    } else {
      for (const post of $posts ?? []) {
        selectedPostIds.delete(post.id);
      }
    }
    selectedPostIds = selectedPostIds;
  };
  const handleSelectPost: ChangeEventHandler<HTMLInputElement> = (event) => {
    const { checked, value } = event.currentTarget;
    if (checked) {
      selectedPostIds.add(value);
    } else {
      selectedPostIds.delete(value);
    }

    selectedPostIds = selectedPostIds;
  };

  const createSpaceCollection = graphql(`
    mutation PostManageTable_CreateSpaceCollection_Mutation($input: CreateSpaceCollectionInput!) {
      createSpaceCollection(input: $input) {
        id
        name
      }
    }
  `);

  const setSpaceCollectionPosts = graphql(`
    mutation PostManageTable_SetSpaceCollectionPosts_Mutation($input: SetSpaceCollectionPostsInput!) {
      setSpaceCollectionPosts(input: $input) {
        id
      }
    }
  `);
</script>

<div class={css({ overflow: 'auto' })}>
  {#if $posts.length > 0}
    <Table style={css.raw({ borderCollapse: 'separate', borderSpacingY: '2px', textAlign: 'left' })}>
      <TableHeader>
        <TableRow>
          <TableHead style={css.raw({ width: '40px' })}>
            <Checkbox on:change={handleSelectAllPost} />
          </TableHead>
          <TableHead style={css.raw({ sm: { maxWidth: '224px' } })}>제목</TableHead>
          <TableHead style={css.raw({ maxWidth: '160px', hideBelow: 'sm' })}>
            {#if type === 'space'}
              작성자
            {:else}
              스페이스
            {/if}
          </TableHead>
          <TableHead style={css.raw({ width: '192px', hideBelow: 'sm' })}>태그</TableHead>
          <TableHead style={css.raw({ smDown: { width: '84px' } })}>공개옵션</TableHead>
          <TableHead style={css.raw({ hideBelow: 'sm' })}>관리</TableHead>
          <!-- 모바일 화면 너비에서 마지막에 빈 테이블 헤드 요소가 없으면 테이블 헤더 오른쪽이 잘리는 문제가 있어서 추가했습니다. -->
          <TableHead style={css.raw({ width: '0' })} />
        </TableRow>
      </TableHeader>

      {#each $posts as post (post.id)}
        <TableRow
          style={css.raw({
            'borderRadius': '8px',
            'borderBottomWidth': '1px',
            'borderBottomColor': 'gray.900/10',
            '_last': { borderBottomWidth: '0' },
            '_selected': { backgroundColor: 'gray.50' },
            '& > td > div': {
              alignItems: 'center',
              smDown: { justifyContent: 'flex-end' },
            },
          })}
          aria-selected={selectedPostIds.has('post.id')}
        >
          <TableData style={css.raw({ paddingRight: '0' })}>
            <Checkbox checked={selectedPostIds.has(post.id)} value={post.id} on:change={handleSelectPost} />
          </TableData>
          <TableData style={css.raw({ sm: { maxWidth: '224px' } })}>
            <a
              class={flex({ justify: 'flex-start', gap: '12px' })}
              href={`/${post.space?.slug}/${post.permalink}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {#if post.thumbnail}
                <Image style={css.raw({ flex: 'none', borderRadius: '8px', size: '42px' })} $image={post.thumbnail} />
              {/if}
              <dl class={css({ truncate: true })}>
                <dt class={css({ fontSize: '15px', fontWeight: 'bold', truncate: true })}>
                  {post.publishedRevision.title ?? '(제목 없음)'}
                </dt>
                <dd class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500' })}>
                  {dayjs(post.publishedAt).formatAsDate()}
                </dd>
              </dl>
            </a>
          </TableData>
          <TableData style={css.raw({ maxWidth: '160px', hideBelow: 'sm' })}>
            <div class={flex({ gap: '4px' })}>
              {#if post.member && post.space}
                {#if type === 'space'}
                  <Avatar style={css.raw({ flex: 'none', size: '20px' })} $profile={post.member.profile} />
                  <span class={css({ fontSize: '13px', fontWeight: 'bold', truncate: true })}>
                    {post.member.profile.name}
                  </span>
                  {#if post.member.id === $spaceMember?.id}
                    <Chip style={css.raw({ paddingX: '8px', paddingY: '4px', width: 'fit' })} color="grass">나</Chip>
                  {/if}
                {:else if type === 'me'}
                  <Avatar style={css.raw({ size: '20px' })} $profile={post.member.profile} />
                  <span class={css({ fontSize: '13px', fontWeight: 'bold' })}>{post.space.name}</span>
                {/if}
              {/if}
            </div>
          </TableData>
          <TableData style={css.raw({ maxWidth: '192px', hideBelow: 'sm' })}>
            <div class={flex({ gap: '4px' })}>
              {#each post.tags.slice(0, 3) as { tag } (tag.id)}
                <Tag size="sm">#{tag.name}</Tag>
              {/each}
              {#if post.tags.length > 2}
                <Tooltip
                  message={post.tags
                    .slice(2)
                    .map(({ tag }) => (tag.name.length < 20 ? tag.name : `${tag.name.slice(0, 20)}...`))
                    .join(', ')}
                  placement="top"
                >
                  <span class={css({ fontSize: '13px', fontWeight: 'bold' })}>+{post.tags.length - 2}</span>
                </Tooltip>
              {/if}
            </div>
          </TableData>
          <TableData style={css.raw({ overflow: 'visible' })}>
            <div class={flex({ gap: '2px' })}>
              {#if post.member}
                <Menu disabled={!hasPermissionToUpdatePost(post.member.id)} placement="bottom-end">
                  <span slot="value" class={flex({ align: 'center', fontSize: '13px', fontWeight: 'bold' })}>
                    <Icon
                      style={css.raw({ marginRight: '2px', color: 'gray.400' })}
                      icon={visibilityToIcon[post.visibility]}
                    />
                    {visibilityToLocaleString[post.visibility]}
                    {#if hasPermissionToUpdatePost(post.member.id)}
                      <Icon style={css.raw({ color: 'gray.400' })} icon={IconChevronDown} />
                    {/if}
                  </span>

                  {#each visibilityOptions as visibilityOption (visibilityOption.value)}
                    <MenuItem
                      aria-pressed={post.visibility === visibilityOption.value}
                      on:click={() =>
                        updateVisibility({
                          postId: post.id,
                          visibility: visibilityOption.value,
                        })}
                    >
                      {visibilityOption.label}
                    </MenuItem>
                  {/each}
                </Menu>
              {/if}
            </div>
          </TableData>
          <TableData style={css.raw({ hideBelow: 'sm' })}>
            {#if post.member}
              <div class={flex({ gap: '8px' })} hidden={!hasPermissionToUpdatePost(post.member.id)}>
                <Button
                  style={css.raw({ _disabled: { visibility: 'hidden' } })}
                  color="tertiary"
                  disabled={type === 'space' && post.member.id !== $spaceMember?.id}
                  external
                  href={`/editor/${post.permalink}`}
                  size="sm"
                  type="link"
                  variant="outlined"
                >
                  수정
                </Button>
                <Button
                  style={css.raw({ padding: '0', _disabled: { visibility: 'hidden' } })}
                  disabled={type === 'space' && (post.member.id !== $spaceMember?.id || $spaceMember?.role !== 'ADMIN')}
                  size="sm"
                  variant="text"
                  on:click={() => {
                    deletePostId = post.id;
                    openDeletePostWaring = true;
                  }}
                >
                  <Icon style={css.raw({ color: { base: 'gray.500', _hover: '[#F66062]' } })} icon={IconTrash} />
                </Button>
              </div>
            {/if}
          </TableData>
          <TableData></TableData>
        </TableRow>
      {/each}
    </Table>
  {:else}
    <p class={css({ marginY: '120px', textAlign: 'center', fontWeight: 'medium' })}>작성한 포스트가 없어요</p>
  {/if}
</div>

{#if $posts.length > 0}
  <div
    class={css(
      {
        position: 'sticky',
        bottom: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        alignSelf: 'center',
        borderRadius: '16px',
        paddingX: '24px',
        paddingY: '8px',
        backgroundColor: 'gray.5',
        boxShadow: '[0 4px 16px 0 {colors.gray.900/15}]',
        translate: 'auto',
        transition: 'all',
      },
      selectedPostCount > 0
        ? { opacity: '100', visibility: 'visible', translateY: '0' }
        : { opacity: '0', visibility: 'hidden', translateY: '16px' },
    )}
  >
    <span class={css({ fontSize: '15px', fontWeight: 'bold' })} aria-live="polite">
      {selectedPostCount}개의 포스트 선택됨
    </span>
    <div class={flex({ justify: 'center', gap: '16px', wrap: 'wrap' })}>
      {#if selectedOwnPosts || $spaceMember?.role === 'ADMIN'}
        <Menu style={css.raw({ hideBelow: 'sm' })} as="div" offset={toolbarMenuOffset} placement="top">
          <Button slot="value" style={css.raw({ whiteSpace: 'nowrap' })} color="secondary" size="md">
            공개범위 설정
          </Button>
          <MenuItem on:click={() => updateVisibilities('PUBLIC')}>전체 공개</MenuItem>
          <MenuItem on:click={() => updateVisibilities('UNLISTED')}>링크 공개</MenuItem>
          <MenuItem on:click={() => updateVisibilities('SPACE')}>멤버 공개</MenuItem>
        </Menu>
        <Menu
          style={css.raw(type === 'space' && { hideBelow: 'sm' })}
          as="div"
          offset={toolbarMenuOffset}
          placement="top"
          preventClose
        >
          <Button slot="value" style={css.raw({ whiteSpace: 'nowrap' })} color="secondary" size="md">
            포스트 옵션 설정
          </Button>
          <MenuItem type="div">
            <Switch
              style={flex.raw({
                justify: 'space-between',
                align: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 'medium',
              })}
              checked={receiveFeedback}
              on:change={(event) => {
                receiveFeedback = event.currentTarget.checked;

                updatePostsOptions({ receiveFeedback });
              }}
            >
              피드백
            </Switch>
          </MenuItem>
          <MenuItem type="div">
            <Switch
              style={flex.raw({
                justify: 'space-between',
                align: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 'medium',
              })}
              checked={receiveTagContribution}
              on:change={(event) => {
                receiveTagContribution = event.currentTarget.checked;

                updatePostsOptions({ receiveTagContribution });
              }}
            >
              태그 수정
            </Switch>
          </MenuItem>
          <MenuItem type="div">
            <Switch
              style={flex.raw({
                justify: 'space-between',
                align: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 'medium',
              })}
              checked={discloseStats}
              on:change={(event) => {
                discloseStats = event.currentTarget.checked;

                updatePostsOptions({ discloseStats });
              }}
            >
              통계 공개
            </Switch>
          </MenuItem>
        </Menu>
      {/if}
      {#if type === 'space'}
        <Menu as="div" offset={toolbarMenuOffset}>
          <Button slot="value" style={css.raw({ whiteSpace: 'nowrap' })} color="secondary" size="md">
            컬렉션 추가
          </Button>
          {#each $collections as collection (collection.id)}
            <MenuItem
              style={flex.raw({ width: '10px' })}
              aria-pressed={selectedCollectionId === collection.id}
              on:click={async () => {
                await setSpaceCollectionPosts({
                  collectionId: collection.id,
                  postIds: selectedPosts.map((post) => post.id),
                });
              }}
            >
              {collection.name}
              <Icon
                style={css.raw({
                  color: '[#4ECEA6]',
                  visibility: { base: 'hidden', _pressed: 'visible' },
                })}
                icon={IconCheck}
              />
            </MenuItem>
          {/each}
          <MenuItem style={flex.raw({ align: 'center', gap: '10px' })} on:click={() => (openCreateCollection = true)}>
            <Icon style={css.raw({ color: 'gray.500' })} icon={IconPlus} />
            새로 만들기
          </MenuItem>
        </Menu>
      {/if}
      {#if selectedOwnPosts || $spaceMember?.role === 'ADMIN'}
        <Button
          style={css.raw({ whiteSpace: 'nowrap' }, type === 'space' && { hideBelow: 'sm' })}
          color="red"
          size="md"
          on:click={() => {
            deletePostIds = _selectedPostIds;
            openDeletePostWaring = true;
          }}
        >
          삭제하기
        </Button>
      {/if}
    </div>
  </div>
{/if}

<Modal size="sm" bind:open={openDeletePostWaring}>
  <svelte:fragment slot="title">정말 포스트를 삭제하시겠어요?</svelte:fragment>

  <div slot="action" class={flex({ gap: '8px', width: 'full' })}>
    <Button
      style={css.raw({ flexGrow: '1' })}
      color="secondary"
      size="md"
      on:click={() => {
        openDeletePostWaring = false;

        deletePostIds = null;
        deletePostId = null;
      }}
    >
      취소
    </Button>
    <Button
      style={css.raw({ flexGrow: '1' })}
      size="md"
      on:click={async () => {
        if (deletePostId) {
          await deletePost({ postId: deletePostId });
        } else if (deletePostIds) {
          await deletePost({ postIds: deletePostIds });
        } else {
          throw new Error('기대하지 않은 경우예요');
        }

        openDeletePostWaring = false;

        deletePostId = null;
        deletePostIds = null;
      }}
    >
      삭제
    </Button>
  </div>
</Modal>

<Modal size="md" bind:open={openCreateCollection}>
  <svelte:fragment slot="title">
    <form
      id="create-collection"
      class={css({ width: 'fit' })}
      on:submit|preventDefault={async (event) => {
        if (!(event.currentTarget.collectionName instanceof HTMLInputElement))
          throw new Error('기대하지 않은 경우입니다.');
        if (!selectedPosts[0].space) return;

        const name = event.currentTarget.collectionName.value.trim() || '새 컬렉션';

        createingCollection = true;
        const { id: collectionId } = await createSpaceCollection({ name, spaceId: selectedPosts[0].space.id });
        const postIds = selectedPosts.map((post) => post.id);
        await setSpaceCollectionPosts({ collectionId, postIds });

        mixpanel.track('space:collection:create', {
          spaceId: selectedPosts[0].id,
          collectionId,
          postIds,
        });

        openCreateCollection = false;
        createingCollection = false;
      }}
    >
      <Editable name="collectionName" maxlength={20} placeholder="컬렉션명" type="text" />
    </form>
  </svelte:fragment>
  <svelte:fragment slot="subtitle">컬렉션에 노출되는 포스트를 관리하세요</svelte:fragment>
  <ul class={flex({ direction: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' })}>
    {#each selectedPosts as post (post.id)}
      <li class={flex({ align: 'center', gap: '12px', paddingY: '8px' })}>
        {#if post.thumbnail}
          <Image style={css.raw({ flex: 'none', borderRadius: '8px', size: '60px' })} $image={post.thumbnail} />
        {/if}
        <dl class={css({ truncate: true })}>
          <dt class={css({ fontSize: '15px', fontWeight: 'bold', truncate: true })}>
            {post.publishedRevision.title ?? '(제목 없음)'}
          </dt>
          <dd class={css({ fontSize: '13px', fontWeight: 'medium', color: 'gray.500', truncate: true })}>
            {dayjs(post.publishedAt).formatAsDate()}
          </dd>
        </dl>
      </li>
    {/each}
  </ul>
  <Button
    slot="action"
    style={css.raw({ width: 'full' })}
    form="create-collection"
    loading={createingCollection}
    size="lg"
    type="submit"
  >
    컬렉션 생성하기
  </Button>
</Modal>
