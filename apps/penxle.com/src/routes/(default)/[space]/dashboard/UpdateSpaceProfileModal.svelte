<script lang="ts">
  import { fragment, graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Image, Modal } from '$lib/components';
  import { FormField, Switch, TextInput } from '$lib/components/forms';
  import { ThumbnailPicker } from '$lib/components/media';
  import { createMutationForm } from '$lib/form';
  import { UpdateSpaceProfileSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import type { SpaceDashboardLayout_UpdateSpaceProfileModal_query } from '$glitch';

  let _query: SpaceDashboardLayout_UpdateSpaceProfileModal_query;
  export { _query as $query };
  export let open = false;

  let thumbnailPicker: ThumbnailPicker;
  let useSpaceProfile = true;

  $: query = fragment(
    _query,
    graphql(`
      fragment SpaceDashboardLayout_UpdateSpaceProfileModal_query on Query {
        me @_required {
          id
        }

        space(slug: $slug) {
          id

          meAsMember @_required {
            id

            profile {
              id
              name

              avatar {
                id
                ...Image_image
              }
            }
          }
        }
      }
    `),
  );

  let avatar: typeof $query.space.meAsMember.profile.avatar;
  $: avatar = $query.space.meAsMember.profile.avatar;

  const { form, handleSubmit, data, setInitialValues } = createMutationForm({
    mutation: graphql(`
      mutation SpaceSettingLayout_UpdateSpaceProfileModal_UpdateSpaceProfile_Mutation(
        $input: UpdateSpaceProfileInput!
      ) {
        updateSpaceProfile(input: $input) {
          id

          profile {
            id
            name

            avatar {
              id
            }
          }
        }
      }
    `),
    schema: UpdateSpaceProfileSchema,
    extra: () => ({ profileAvatarId: avatar.id }),
    onSuccess: () => {
      open = false;
      mixpanel.track('space:profile:update', { spaceId: $query.space.id });
    },
  });

  $: setInitialValues({
    profileName: $query.space.meAsMember.profile.name,
    profileAvatarId: $query.space.meAsMember.profile.avatar.id,
    spaceId: $query.space.id,
  });

  const deleteSpaceProfile = graphql(`
    mutation SpaceSettingLayout_UpdateSpaceProfileModal_DeleteSpaceProfile_Mutation($input: DeleteSpaceProfileInput!) {
      deleteSpaceProfile(input: $input) {
        id

        profile {
          id
          name

          avatar {
            id
          }
        }
      }
    }
  `);
</script>

<Modal bind:open>
  <svelte:fragment slot="title">스페이스 전용 프로필 수정</svelte:fragment>
  <svelte:fragment slot="subtitle">스페이스에서만 보여질 프로필을 설정해요</svelte:fragment>

  <form use:form>
    <Switch
      style={flex.raw({ justify: 'space-between', align: 'center', marginBottom: '16px' })}
      bind:checked={useSpaceProfile}
    >
      <span class={css({ fontWeight: 'bold' })}>스페이스 전용 프로필</span>
    </Switch>

    <div class={css({ display: 'flex', gap: '12px', width: 'full' }, !useSpaceProfile && { display: 'none' })}>
      <button
        class={center({
          flex: 'none',
          borderRadius: '12px',
          size: '77px',
          backgroundColor: 'gray.50',
          overflow: 'hidden',
        })}
        type="button"
        on:click={() => thumbnailPicker.show()}
      >
        <Image style={css.raw({ size: 'full' })} $image={avatar} />
      </button>

      <FormField name="profileName" style={css.raw({ flexGrow: '1' })} label="닉네임">
        <TextInput maxlength={20} placeholder="닉네임 입력">
          <span slot="right-icon" class={css({ fontSize: '14px', fontWeight: 'medium', color: 'gray.500' })}>
            {$data.profileName?.length ?? 0}/20
          </span>
        </TextInput>
      </FormField>
    </div>

    <Button
      style={css.raw({ marginTop: '16px', width: 'full' })}
      size="xl"
      on:click={async () => {
        if (useSpaceProfile) {
          handleSubmit();
        } else {
          await deleteSpaceProfile({ spaceId: $query.space.id });
          mixpanel.track('space:profile:delete', { spaceId: $query.space.id });
          open = false;
        }
      }}
    >
      프로필 저장하기
    </Button>
  </form>
</Modal>

<ThumbnailPicker bind:this={thumbnailPicker} on:change={(e) => (avatar = e.detail)} />
