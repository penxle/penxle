<script lang="ts">
  import IconCamera from '~icons/tabler/camera';
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Icon, Image, Modal } from '$lib/components';
  import { FormField, TextInput } from '$lib/components/forms';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { UpdateUserProfileSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
  import type { MeSettingsPage_UpdateProfileModal_profile } from '$glitch';

  let _profile: MeSettingsPage_UpdateProfileModal_profile;
  export { _profile as $profile };
  export let open = false;

  let thumbnailPicker: ThumbnailPicker;

  $: profile = fragment(
    _profile,
    graphql(`
      fragment MeSettingsPage_UpdateProfileModal_profile on Profile {
        id
        name
        avatar {
          id
          ...Image_image
        }
      }
    `),
  );

  let avatar: typeof $profile.avatar;
  $: avatar = $profile.avatar;

  const { form, data, setInitialValues } = createMutationForm({
    mutation: graphql(`
      mutation MeSettingsPage_UpdateProfileModal_UpdateUserProfile_Mutation($input: UpdateUserProfileInput!) {
        updateUserProfile(input: $input) {
          id
          name
          avatar {
            id
          }
        }
      }
    `),
    schema: UpdateUserProfileSchema,
    initialValues: { name: '' },
    extra: () => ({ avatarId: avatar.id }),
    onSuccess: () => {
      mixpanel.track('user:profile:update');
      open = false;
    },
  });

  $: setInitialValues({
    avatarId: avatar.id,
    name: $profile.name,
  });
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">프로필 수정</svelte:fragment>

  <form use:form>
    <button
      class={center({
        'position': 'relative',
        'flexDirection': 'column',
        'borderRadius': '[24px]',
        'marginX': 'auto',
        'marginBottom': '12px',
        'backgroundColor': 'gray.50',
        'size': '320px',
        'overflow': 'hidden',
        '& > div': {
          _hover: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
      })}
      type="button"
      on:click={() => thumbnailPicker.show()}
    >
      <Image style={css.raw({ size: 'full' })} $image={avatar} />
      <div
        class={css({
          userSelect: 'none',
          position: 'absolute',
          top: '1/2',
          translateY: '-1/2',
          display: 'none',
          borderRadius: 'full',
          backgroundColor: 'gray.900/50',
          size: '60px',
        })}
      >
        <Icon style={css.raw({ color: '[#FFF9F8]' })} icon={IconCamera} size={24} />
      </div>
    </button>

    <FormField name="name" label="닉네임">
      <TextInput style={css.raw({ fontWeight: 'bold', width: 'full' })} maxlength={20} placeholder="닉네임 입력">
        <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.400' })}>
          {$data.name.length} / 20
        </span>
      </TextInput>
    </FormField>
    <Button style={css.raw({ marginTop: '16px', width: 'full' })} size="xl" type="submit">수정</Button>
  </form>
</Modal>

<ThumbnailPicker bind:this={thumbnailPicker} on:change={(e) => (avatar = e.detail)} />
