<script lang="ts">
  import { FormValidationMessage } from '$lib/components/forms';
  import { setFormField } from '$lib/form';
  import { css } from '$styled-system/css';
  import type { SystemStyleObject } from '$styled-system/types';

  export let style: SystemStyleObject | undefined = undefined;
  export let name: string;
  export let label: string;
  export let hideLabel = false;

  setFormField({
    name,
  });
</script>

<section class={css(style)}>
  <label
    class={css(
      { display: 'inline-block', marginBottom: '6px', fontSize: '14px' },
      hideLabel && { visibility: 'hidden' },
    )}
    for={name}
  >
    {label}
  </label>
  <slot />
  <div
    class={css({
      marginTop: '6px',
      fontSize: '13px',
      color: 'red.600',
      lineHeight: 'none',
      minHeight: '18px',
    })}
  >
    <FormValidationMessage for={name} let:message>
      * {message}
    </FormValidationMessage>
  </div>
</section>
