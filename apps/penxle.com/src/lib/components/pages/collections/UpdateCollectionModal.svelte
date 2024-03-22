<script lang="ts">
  import mixpanel from 'mixpanel-browser';
  import IconCamera from '~icons/tabler/camera';
  import { fragment, graphql } from '$glitch';
  import { Button, Icon, Image, Modal } from '$lib/components';
  import { FormField, TextInput } from '$lib/components/forms';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { toast } from '$lib/notification';
  import { UpdateSpaceCollectionSchema } from '$lib/validations';
  import { css, cx } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import type { UpdateCollectionModal_Collection_query } from '$glitch';

  let thumbnailPicker: ThumbnailPicker;
  export let open = false;
  export let spaceId: string;

  let _collection: UpdateCollectionModal_Collection_query;

  export { _collection as $collection };

  $: collection = fragment(
    _collection,
    graphql(`
      fragment UpdateCollectionModal_Collection_query on SpaceCollection {
        id
        name
        thumbnail {
          id
          ...Image_image
        }
      }
    `),
  );

  let thumbnail: typeof $collection.thumbnail;
  $: thumbnail = $collection.thumbnail;

  const { form, setInitialValues, isSubmitting } = createMutationForm({
    mutation: graphql(`
      mutation UpdateSpaceCollectionModal_UpdateSpaceCollection_Mutation($input: UpdateSpaceCollectionInput!) {
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
    extra: () => ({ thumbnailId: thumbnail?.id }),
    onSuccess: ({ id }) => {
      open = false;
      mixpanel.track('space:collection:update', { spaceId, collectionId: id });
      toast.success('컬렉션이 수정되었어요');
    },
  });

  $: setInitialValues({
    spaceCollectionId: $collection.id,
    name: $collection.name,
    thumbnailId: $collection.thumbnail?.id,
  });
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">컬렉션 관리</svelte:fragment>
  <form use:form>
    <button
      class={cx(
        'group',
        center({
          position: 'relative',
          flexDirection: 'column',
          borderRadius: '[24px]',
          marginX: 'auto',
          width: 'full',
          aspectRatio: '[3/4]',
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
            visibility: 'hidden',
          },
          thumbnail
            ? { visibility: { base: 'hidden', _groupHover: 'visible', _groupActive: 'visible' } }
            : { visibility: 'visible' },
        )}
      >
        <Icon style={css.raw({ color: 'gray.5' })} icon={IconCamera} size={24} />
      </div>
    </button>
    <div
      id="upload-restriction"
      class={css({ marginY: '12px', fontSize: '13px', fontWeight: 'medium', color: 'gray.400' })}
    >
      JPG, PNG 업로드 가능
    </div>
    <FormField name="name" label="컬렉션명">
      <TextInput style={css.raw({ width: 'full', fontWeight: 'bold' })} maxlength={20} required />
    </FormField>
    <Button style={css.raw({ marginTop: '24px', width: 'full' })} loading={$isSubmitting} size="xl" type="submit">
      컬렉션 수정하기
    </Button>
  </form>
</Modal>

<ThumbnailPicker bind:this={thumbnailPicker} ratio="rectangle" on:change={(e) => (thumbnail = e.detail)} />
