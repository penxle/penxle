<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Modal } from '$lib/components';
  import { FormField, Switch, TextInput } from '$lib/components/forms';
  import Image from '$lib/components/Image.svelte';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { CreateSpaceSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
  import type { CreateSpaceModal_user } from '$glitch';

  let _user: CreateSpaceModal_user;
  export { _user as $user };

  let useSpaceProfile = true;
  let thumbnailPicker: ThumbnailPicker;

  export let open = false;
  export let via: 'user-menu' | 'space-list-menu' | 'editor' = 'user-menu';

  const dispatch = createEventDispatcher<{ create: { id: string } }>();

  $: user = fragment(
    _user,
    graphql(`
      fragment CreateSpaceModal_user on User {
        id
        email

        profile {
          id
          name

          avatar {
            id
            ...Image_image
          }
        }
      }
    `),
  );

  let avatar: typeof $user.profile.avatar;
  $: avatar = $user.profile.avatar;

  const { form, handleSubmit, isSubmitting, data, setFields, setInitialValues } = createMutationForm({
    mutation: graphql(`
      mutation CreateSpaceModal_CreateSpace_Mutation($input: CreateSpaceInput!) {
        createSpace(input: $input) {
          id
          slug
        }
      }
    `),
    schema: CreateSpaceSchema,
    initialValues: { profileName: '' },
    extra: () => ({ profileAvatarId: avatar.id }),
    onSuccess: async ({ id, slug }) => {
      dispatch('create', { id });

      mixpanel.track('space:create', { useSpaceProfile, via });
      open = false;

      if (via === 'user-menu') {
        await goto(`/${slug}`);
      } else if (via === 'space-list-menu') {
        await goto(`/${slug}/dashboard/settings`);
      }
    },
  });

  $: if (open) {
    useSpaceProfile = true;
  }

  $: setInitialValues({
    profileName: '',
    profileAvatarId: avatar.id,
    name: '',
    slug: '',
    isPublic: true,
  });

  $: if (!useSpaceProfile) {
    setFields('profileName', undefined);
    setFields('profileAvatarId', undefined);
  }
</script>

<Modal bind:open>
  <svelte:fragment slot="title">스페이스 만들기</svelte:fragment>

  <form class={flex({ direction: 'column', gap: '12px' })} use:form>
    <FormField name="name" label="스페이스 이름">
      <TextInput maxlength={20} placeholder="스페이스명">
        <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.400' })}>
          {$data.name?.length}/20
        </span>
      </TextInput>
    </FormField>

    <FormField name="slug" label="스페이스 URL">
      <TextInput maxlength={20} placeholder="입력해주세요">
        <span slot="left-text">{$page.url.host}/</span>
        <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.400' })}>
          {$data.slug?.length}/20
        </span>
      </TextInput>
    </FormField>

    <div class={css({ paddingY: '8px' })}>
      <Switch style={flex.raw({ justify: 'space-between', align: 'center' })} bind:checked={useSpaceProfile}>
        <p class={css({ fontSize: '16px', fontWeight: 'bold' })}>스페이스 전용 프로필</p>
      </Switch>
    </div>

    <div class={css({ display: 'flex', gap: '12px' }, !useSpaceProfile && { display: 'none' })}>
      <button
        class={css({
          flexShrink: '0',
          borderRadius: '12px',
          size: '74px',
          backgroundColor: 'gray.50',
          overflow: 'hidden',
        })}
        type="button"
        on:click={() => thumbnailPicker.show()}
      >
        <Image style={css.raw({ size: 'full' })} $image={avatar} />
      </button>

      <FormField name="profileName" style={css.raw({ flexGrow: '1' })} label="스페이스 닉네임">
        <TextInput maxlength={20} placeholder="닉네임 입력">
          <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.400' })}>
            {$data.profileName?.length ?? 0}/20
          </span>
        </TextInput>
      </FormField>
    </div>
  </form>

  <Button slot="action" style={css.raw({ width: 'full' })} loading={$isSubmitting} size="xl" on:click={handleSubmit}>
    스페이스 만들기
  </Button>
</Modal>

<ThumbnailPicker bind:this={thumbnailPicker} on:change={(e) => (avatar = e.detail)} />
