<script lang="ts">
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Button, Modal } from '$lib/components';
  import { FormField, TextInput } from '$lib/components/forms';
  import { createMutationForm } from '$lib/form';
  import { UpdateUserEmailSchema } from '$lib/validations';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';

  export let open = false;
  let value: HTMLInputElement['value'];

  const { form } = createMutationForm({
    mutation: graphql(`
      mutation MeSettingsPage_UpdateUserEmail_Mutation($input: UpdateUserEmailInput!) {
        updateUserEmail(input: $input)
      }
    `),
    schema: UpdateUserEmailSchema,
    onSuccess: () => {
      mixpanel.track('user:email:update:start');
      open = false;
    },
  });
</script>

<Modal size="md" bind:open>
  <svelte:fragment slot="title">변경할 이메일을 입력하세요</svelte:fragment>

  <form class={flex({ flexDirection: 'column', gap: '16px' })} use:form>
    <FormField name="email" label="이메일 주소">
      <TextInput style={css.raw({ fontWeight: 'bold', width: 'full' })} placeholder="이메일 입력" bind:value />
    </FormField>

    <Button style={css.raw({ width: 'full' })} size="xl" type="submit">이메일 인증 보내기</Button>
  </form>
</Modal>
