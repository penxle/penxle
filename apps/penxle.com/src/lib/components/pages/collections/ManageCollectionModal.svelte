<script lang="ts">
  import dayjs from 'dayjs';
  import mixpanel from 'mixpanel-browser';
  import { page } from '$app/stores';
  import { fragment, graphql } from '$glitch';
  import { Button, Modal } from '$lib/components';
  import { Editable, PopupSearch } from '$lib/components/forms';
  import Image from '$lib/components/Image.svelte';
  import { createMutationForm } from '$lib/form';
  import { SetSpaceCollectionPostSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type {
    SpaceCollectionsEnitityPage_ManageCollectionModal_collection,
    SpaceCollectionsEnitityPage_ManageCollectionModal_post,
  } from '$glitch';

  $: slug = $page.params.space;

  let _collection: SpaceCollectionsEnitityPage_ManageCollectionModal_collection;
  let _posts: SpaceCollectionsEnitityPage_ManageCollectionModal_post[];
  export { _collection as $collection, _posts as $posts };
  export let open = false;
  export let spaceId: string;

  let query = '';

  $: posts = fragment(
    _posts,
    graphql(`
      fragment SpaceCollectionsEnitityPage_ManageCollectionModal_post on Post {
        id
        permalink
        publishedAt

        collection {
          id
        }

        thumbnail {
          id
          ...Image_image
        }

        publishedRevision @_required {
          id
          title
        }
      }
    `),
  );

  $: collection = fragment(
    _collection,
    graphql(`
      fragment SpaceCollectionsEnitityPage_ManageCollectionModal_collection on SpaceCollection {
        id
        name

        thumbnail {
          id
          ...Image_image
        }

        posts {
          id
        }
      }
    `),
  );

  let submitButtonEl: HTMLButtonElement;
  let name: string | null = null;

  $: if (open) {
    name = null;
  }

  $: if (name === null) {
    name = $collection.name;
  }

  let registeredPostIds: Set<string>;
  const initializeRegisteredPosts = () => {
    registeredPostIds = new Set($collection.posts.map(({ id }) => id));
  };

  $: if (open) {
    initializeRegisteredPosts();
  }

  const updateSpaceCollection = graphql(`
    mutation ManageSpaceCollectionModal_UpdateSpaceCollection_Mutation($input: UpdateSpaceCollectionInput!) {
      updateSpaceCollection(input: $input) {
        id
        name
      }
    }
  `);

  const { form, setInitialValues, isSubmitting } = createMutationForm({
    mutation: graphql(`
      mutation SpaceCollectionsEnitityPage_ManageCollectionModal_SetSpaceCollectionPosts_Mutation(
        $input: SetSpaceCollectionPostsInput!
      ) {
        setSpaceCollectionPosts(input: $input) {
          id
        }
      }
    `),
    extra: async () => ({ postIds: [...registeredPostIds.values()] }),
    schema: SetSpaceCollectionPostSchema,
    onSuccess: () => {
      open = false;
      mixpanel.track('space:collection:update', {
        spaceId,
        collectionId: $collection.id,
        postIds: [...registeredPostIds.values()],
      });
    },
  });

  $: setInitialValues({ collectionId: $collection.id, postIds: [] });

  const registerPost = (postId: string) => {
    registeredPostIds.add(postId);
    registeredPostIds = registeredPostIds;
  };
  const removePost = async (postId: string) => {
    registeredPostIds.delete(postId);
    registeredPostIds = registeredPostIds;
  };

  $: filteredPosts = $posts.filter((post) => {
    const searchResult = post.publishedRevision?.title?.includes(query);
    const isInOtherCollection = !!post.collection && post.collection.id !== $collection.id;

    return searchResult && !isInOtherCollection;
  });
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">
    <form
      on:submit|preventDefault={async (e) => {
        if (name && name.length > 0 && name !== $collection.name) {
          await updateSpaceCollection({
            collectionId: $collection.id,
            name,
            thumbnailId: $collection.thumbnail?.id,
          });
        }

        // @ts-expect-error: currentTarget.name except HTMLInputElement
        if (!('_name' in e.target && e.target._name instanceof HTMLInputElement))
          throw new Error('Fail to access input element');

        e.target._name.blur();
      }}
    >
      <Editable
        name="_name"
        maxlength={20}
        placeholder="컬렉션명"
        bind:value={name}
        on:blur={() => {
          submitButtonEl.click();
        }}
      />
      <button bind:this={submitButtonEl} class={css({ display: 'none' })} type="submit" />
    </form>
  </svelte:fragment>
  <svelte:fragment slot="subtitle">
    컬렉션에 노출되는 포스트를 관리하세요
    <br />
    한 포스트 당 한 컬렉션에만 속할 수 있어요
  </svelte:fragment>

  <PopupSearch
    style={css.raw({ marginBottom: '16px' }, $posts.length === 0 && { display: 'none' })}
    on:input={(e) => (query = e.currentTarget.value.trim())}
  />
  <form use:form>
    <ul
      class={css(
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '160px',
          maxHeight: '240px',
          overflowY: 'auto',
        },
        filteredPosts.length === 0 && { justifyContent: 'center' },
      )}
    >
      {#each filteredPosts as post (post.id)}
        <li class={flex({ justify: 'space-between', align: 'center' })}>
          <a
            class={flex({ align: 'center', gap: '8px', marginRight: '8px', truncate: true })}
            href="/{slug}/{post.permalink}"
          >
            {#if post.thumbnail}
              <Image style={css.raw({ flex: 'none', borderRadius: '8px', size: '42px' })} $image={post.thumbnail} />
            {/if}
            <div class={css({ truncate: true })}>
              <p class={css({ flexGrow: '1', fontSize: '17px', fontWeight: 'bold', truncate: true })}>
                {post.publishedRevision?.title ?? '(제목 없음)'}
              </p>
              <time
                class={css({ fontSize: '15px', fontWeight: 'medium', color: 'gray.500', truncate: true })}
                datetime={post.publishedAt}
              >
                {dayjs(post.publishedAt).formatAsDate()}
              </time>
            </div>
          </a>
          {#if registeredPostIds.has(post.id)}
            <Button
              style={css.raw({ flex: 'none' })}
              color="tertiary"
              size="md"
              variant="outlined"
              on:click={() => removePost(post.id)}
            >
              해제
            </Button>
          {:else}
            <Button
              style={css.raw({ flex: 'none' })}
              color="secondary"
              size="md"
              on:click={() => registerPost(post.id)}
            >
              추가
            </Button>
          {/if}
        </li>
      {:else}
        <article
          class={flex({
            direction: 'column',
            alignSelf: 'center',
            fontWeight: 'medium',
            color: 'gray.500',
            wordBreak: 'keep-all',
          })}
        >
          {$posts.length === 0 ? '아직 스페이스에 업로드된 포스트가 없어요' : '일치하는 검색 결과가 없어요'}
        </article>
      {/each}
    </ul>
    <div class={flex({ gap: '12px', marginTop: '24px', width: 'full' })}>
      <Button
        style={css.raw({ flex: '1' })}
        disabled={$posts.length === 0}
        loading={$isSubmitting}
        size="xl"
        type="submit"
      >
        저장하기
      </Button>
      <Button
        color="tertiary"
        size="xl"
        variant="outlined"
        on:click={() => {
          open = false;
        }}
      >
        닫기
      </Button>
    </div>
  </form>
</Modal>
