<script lang="ts">
  import dayjs from 'dayjs';
  import IconTrash from '~icons/tabler/trash';
  import { graphql } from '$glitch';
  import { Button, Helmet, Icon, Image } from '$lib/components';
  import {
    CreateCollectionModal,
    ManageCollectionModal,
    UpdateCollectionModal,
  } from '$lib/components/pages/collections';
  import { Table, TableData, TableHead, TableHeader, TableRow } from '$lib/components/table';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';

  let openManageCollectionModal = false;
  let openCreateCollectionModal = false;
  let openUpdateCollectionModal = false;

  $: query = graphql(`
    query SpaceSettingCollectionPage_Query($slug: String!) {
      space(slug: $slug) {
        id

        name
        slug

        meAsMember {
          id
          ...PostManageTable_SpaceMember
        }

        posts {
          ...SpaceCollectionsEnitityPage_ManageCollectionModal_post
        }

        collections {
          id

          name
          count
          createdAt

          thumbnail {
            ...Image_image
          }

          ...UpdateCollectionModal_Collection_query
          ...SpaceCollectionsEnitityPage_ManageCollectionModal_collection
        }
      }
    }
  `);

  const deleteSpaceCollection = graphql(`
    mutation SpaceSettingCollectionPage_deleteSpaceCollection_Mutation($input: DeleteSpaceCollectionInput!) {
      deleteSpaceCollection(input: $input) {
        id
      }
    }
  `);

  let selectedCollection: (typeof $query.space.collections)[number] | null = null;
  let deleting = false;
</script>

<Helmet description={`${$query.space.name} 스페이스 컬렉션 관리`} title={`컬렉션 관리 | ${$query.space.name}`} />

<div class={flex({ justify: 'space-between', gap: '8px' })}>
  <div class={flex({ gap: '8px' })}>
    <Button size="md" on:click={() => (openCreateCollectionModal = true)}>새 컬렉션 생성</Button>
  </div>
</div>

<div class={css({ overflowY: 'auto' })}>
  <Table style={css.raw({ borderSpacingY: '2px', borderCollapse: 'separate', textAlign: 'left' })}>
    <TableHeader>
      <TableRow>
        <TableHead>컬렉션</TableHead>
        <TableHead style={css.raw({ hideBelow: 'sm' })}>생성일</TableHead>
        <TableHead>관리</TableHead>
      </TableRow>
    </TableHeader>
    <colgroup>
      <col span="1" />
      <col class={css({ width: '128px', hideBelow: 'sm' })} span="1" />
      <col class={css({ width: '184px', smDown: { width: '80px' } })} span="1" />
    </colgroup>
    {#each $query.space.collections as collection (collection.id)}
      <TableRow>
        <TableData>
          <a class={flex({ gap: '12px' })} href={`/${$query.space.slug}/collections/${collection.id}`}>
            {#if collection.thumbnail}
              <Image
                style={css.raw({ width: '96px', height: '120px', borderRadius: '8px', flexShrink: 0 })}
                $image={collection.thumbnail}
              />
            {/if}
            <dl
              class={css({
                'overflow': 'hidden',
                'textOverflow': 'ellipsis',
                'whiteSpace': 'nowrap',
                '&>dt': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              })}
            >
              <dt class={css({ marginBottom: '4px', fontSize: '15px', fontWeight: 'bold' })}>
                {collection.name}
              </dt>
              <dd
                class={css({
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: 'gray.500',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'keep-all',
                })}
              >
                {collection.count}개의 포스트
              </dd>
            </dl>
          </a>
        </TableData>
        <TableData style={css.raw({ hideBelow: 'sm', fontSize: '13px', fontWeight: 'bold', color: 'gray.400' })}>
          {dayjs(collection.createdAt).formatAsDate()}
        </TableData>
        <TableData>
          <div class={flex({ gap: '8px' })}>
            <Button
              style={css.raw({ hideBelow: 'sm' })}
              color="tertiary"
              size="sm"
              variant="outlined"
              on:click={() => {
                selectedCollection = collection;
                openManageCollectionModal = true;
              }}
            >
              포스트 관리
            </Button>
            <Button
              color="tertiary"
              size="sm"
              variant="outlined"
              on:click={() => {
                selectedCollection = collection;
                openUpdateCollectionModal = true;
              }}
            >
              <span class={css({ hideBelow: 'sm', sm: { marginRight: '2px' } })}>컬렉션</span>
              관리
            </Button>
            <Button
              style={css.raw({ padding: '0', _disabled: { visibility: 'hidden' } })}
              loading={deleting}
              size="sm"
              variant="text"
              on:click={async () => {
                deleting = true;
                await deleteSpaceCollection({ collectionId: collection.id });
                deleting = false;
              }}
            >
              <Icon style={css.raw({ color: 'gray.500', _hover: { color: 'red.600' } })} icon={IconTrash} />
            </Button>
          </div>
        </TableData>
      </TableRow>
    {/each}
  </Table>
</div>
<CreateCollectionModal spaceId={$query.space.id} bind:open={openCreateCollectionModal} />
{#if selectedCollection}
  <ManageCollectionModal
    $collection={selectedCollection}
    $posts={$query.space.posts}
    spaceId={$query.space.id}
    bind:open={openManageCollectionModal}
  />
  <UpdateCollectionModal
    $collection={selectedCollection}
    spaceId={$query.space.id}
    bind:open={openUpdateCollectionModal}
  />
{/if}
