<script lang="ts">
  import mixpanel from 'mixpanel-browser';
  import IconCamera from '~icons/tabler/camera';
  import { graphql } from '$glitch';
  import { Button, Icon, Image, Modal } from '$lib/components';
  import { FormField, TextInput } from '$lib/components/forms';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { toast } from '$lib/notification';
  import { UpdateSpaceCollectionSchema } from '$lib/validations';
  import { css, cx } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import type { Image_image } from '$glitch';

  let thumbnailPicker: ThumbnailPicker;
  export let open = false;
  export let spaceId: string;

  let thumbnail: (Image_image & { id: string }) | null = null;

  $: if (open) {
    thumbnail = null;
  }

  const createSpaceCollection = graphql(`
    mutation CreateCollectionModal_CreateSpaceCollection_Mutation($input: CreateSpaceCollectionInput!) {
      createSpaceCollection(input: $input) {
        id
        name
      }
    }
  `);

  const { form, isSubmitting } = createMutationForm({
    mutation: graphql(`
      mutation CreateSpaceCollectionModal_UpdateSpaceCollection_Mutation($input: UpdateSpaceCollectionInput!) {
        updateSpaceCollection(input: $input) {
          id
          name
          thumbnail {
            ...Image_image
          }
        }
      }
    `),
    schema: UpdateSpaceCollectionSchema,
    extra: async () => {
      const defaultName = '_';
      const createdCollection = await createSpaceCollection({ spaceId, name: defaultName });

      return { spaceCollectionId: createdCollection.id, thumbnailId: thumbnail?.id };
    },
    initialValues: {
      spaceCollectionId: '',
    },
    onSuccess: ({ id }) => {
      open = false;
      mixpanel.track('space:collection:create', { spaceId, collectionId: id });
      toast.success('컬렉션이 생성되었어요');
    },
  });
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">새 컬렉션 생성</svelte:fragment>
  <form use:form>
    <button
      class={cx(
        'group',
        center({
          position: 'relative',
          flexDirection: 'column',
          borderRadius: '[24px]',
          marginX: 'auto',
          width: '333px',
          height: '416px',
          backgroundColor: 'gray.50',
          overflow: 'hidden',
        }),
      )}
      aria-describedby="upload-restriction"
      type="button"
      on:click={() => thumbnailPicker.show()}
    >
      {#if thumbnail}
        <Image style={css.raw({ size: 'full' })} $image={thumbnail} />
      {/if}
      <div
        class={css(
          {
            position: 'absolute',
            top: '1/2',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 'full',
            size: '60px',
            backgroundColor: 'gray.900/50',
            translate: 'auto',
            translateY: '-1/2',
            userSelect: 'none',
            visibility: 'hidden',
          },
          thumbnail
            ? { _groupHover: { visibility: 'visible' }, _groupActive: { visibility: 'visible' } }
            : { visibility: 'visible' },
        )}
      >
        <Icon style={css.raw({ color: 'gray.50' })} icon={IconCamera} size={24} />
      </div>
    </button>
    <div
      id="upload-restriction"
      class={css({ marginY: '12px', fontSize: '13px', fontWeight: 'medium', color: 'gray.400' })}
    >
      JPG, PNG 업로드 가능
    </div>
    <FormField name="name" label="컬렉션명">
      <TextInput style={css.raw({ width: 'full' })} maxlength={20} placeholder="이름" required />
    </FormField>
    <Button style={css.raw({ marginTop: '24px', width: 'full' })} loading={$isSubmitting} size="xl" type="submit">
      컬렉션 생성하기
    </Button>
  </form>
</Modal>

<ThumbnailPicker bind:this={thumbnailPicker} ratio="rectangle" on:change={(e) => (thumbnail = e.detail)} />
