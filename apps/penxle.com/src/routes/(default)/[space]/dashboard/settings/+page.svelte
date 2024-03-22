<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Helmet, Image } from '$lib/components';
  import { FormField, Switch, TextArea, TextInput } from '$lib/components/forms';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { toast } from '$lib/notification';
  import { pageSubTitle } from '$lib/stores';
  import { UpdateSpaceSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import DeleteSpaceModal from './DeleteSpaceModal.svelte';

  let thumbnailPicker: ThumbnailPicker;
  let openDeleteSpace = false;

  onMount(async () => {
    pageSubTitle.set('스페이스 설정');
  });

  $: query = graphql(`
    query SpaceDashboardSettingsPage_Query($slug: String!) {
      space(slug: $slug) {
        id
        slug
        name
        description
        visibility

        # externalLinks {
        #   id
        #   url
        # }

        icon {
          id
          ...Image_image
        }

        meAsMember {
          id
          role

          profile {
            id

            avatar {
              id
            }
          }
        }

        ...SpaceDashboardSettingsPage_DeleteSpaceModal_space
      }
    }
  `);

  let icon: typeof $query.space.icon;
  $: icon = $query.space.icon;

  const { form, data, setInitialValues, isSubmitting, handleSubmit } = createMutationForm({
    mutation: graphql(`
      mutation SpaceDashboardSettingsPage_UpdateSpace_Mutation($input: UpdateSpaceInput!) {
        updateSpace(input: $input) {
          id
          slug
          name
          description
          visibility

          # externalLinks {
          #   id
          #   url
          # }

          icon {
            id
            ...Image_image
          }
        }
      }
    `),
    schema: UpdateSpaceSchema,
    extra: () => ({
      iconId: icon.id,
    }),
    onSuccess: async () => {
      mixpanel.track('space:update', { spaceId: $query.space.id });
      toast.success('스페이스 설정이 변경되었어요');
      await goto(`/${$data.slug}/dashboard/settings`);
    },
  });

  $: setInitialValues({
    spaceId: $query.space.id,
    iconId: $query.space.icon.id,
    name: $query.space.name,
    slug: $query.space.slug,
    description: $query.space.description ?? '',
    isPublic: $query.space.visibility === 'PUBLIC',
  });
</script>

<Helmet description={`${$query.space.name} 스페이스 설정`} title={`설정 | ${$query.space.name}`} />

<div class={css({ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold', hideBelow: 'sm' })}>
  <h2>스페이스 설정</h2>
</div>

<div
  class={css({
    smDown: {
      borderWidth: '1px',
      borderColor: 'gray.200',
      borderRadius: '12px',
      marginX: '16px',
      marginY: '20px',
      paddingX: '16px',
      paddingY: '24px',
      backgroundColor: 'gray.5',
    },
  })}
>
  <form
    class={css({
      sm: {
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '12px',
        padding: '24px',
        backgroundColor: 'gray.5',
      },
    })}
    use:form
  >
    <input name="spaceId" type="hidden" value={$query.space.id} />

    <div class={flex({ direction: 'column', gap: '24px' })}>
      <div>
        <div class={flex({ align: 'center', gap: '12px', width: 'full' })}>
          <button
            class={css({
              flex: 'none',
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '12px',
              size: '76px',
              backgroundColor: 'gray.50',
              overflow: 'hidden',
            })}
            type="button"
            on:click={() => thumbnailPicker.show()}
          >
            <Image style={css.raw({ size: 'full' })} $image={icon} />
          </button>

          <FormField name="name" style={css.raw({ flexGrow: '1' })} label="스페이스명">
            <TextInput style={css.raw({ width: 'full' })} maxlength={20} placeholder="스페이스명을 입력해주세요">
              <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'semibold', color: 'gray.400' })}>
                {$data.name?.length ?? 0}/20
              </span>
            </TextInput>
          </FormField>
        </div>
        <p class={css({ marginTop: '8px', fontSize: '13px', fontWeight: 'medium', color: 'gray.400' })}>
          JPG, PNG 업로드 가능
        </p>
      </div>

      <FormField name="description" label="스페이스 소개">
        <TextArea style={css.raw({ width: 'full' })} maxlength={200} placeholder="스페이스 설명을 입력해주세요">
          <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'semibold', color: 'gray.400' })}>
            {$data.description?.length ?? 0}/200
          </span>
        </TextArea>
      </FormField>

      <FormField name="slug" label="스페이스 고유 URL">
        <TextInput style={css.raw({ width: 'full' })} maxlength={20} placeholder="URL을 입력해주세요">
          <span slot="left-text">{$page.url.host}/</span>
          <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'semibold', color: 'gray.400' })}>
            {$data.slug?.length ?? 0}/20
          </span>
        </TextInput>
      </FormField>
    </div>

    <Switch name="isPublic" style={flex.raw({ justify: 'space-between', marginTop: '32px', fontWeight: 'bold' })}>
      <p>스페이스 공개</p>
    </Switch>
  </form>

  <div>
    <Button
      style={css.raw({ marginTop: { base: '32px', sm: '24px' }, width: 'full' })}
      loading={$isSubmitting}
      size="xl"
      type="submit"
      on:click={handleSubmit}
    >
      설정 저장하기
    </Button>

    {#if $query.space.meAsMember?.role === 'ADMIN'}
      <Button
        style={css.raw({ marginTop: '16px', width: 'full', fontSize: '16px', fontWeight: 'medium' })}
        size="sm"
        variant="text"
        on:click={() => (openDeleteSpace = true)}
      >
        스페이스 삭제
      </Button>
    {/if}
  </div>
</div>

<DeleteSpaceModal $space={$query.space} bind:open={openDeleteSpace} />
<ThumbnailPicker bind:this={thumbnailPicker} on:change={(e) => (icon = e.detail)} />
