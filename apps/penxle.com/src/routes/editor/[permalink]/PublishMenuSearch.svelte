<script lang="ts">
  import * as R from 'radash';
  import IconAlertCircle from '~icons/tabler/alert-circle';
  import { Icon, Tooltip } from '$lib/components';
  import { tagPattern } from '$lib/const/post';
  import { toast } from '$lib/notification';
  import { outsideClickEvent } from '$lib/svelte/actions';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import Chip from './Chip.svelte';
  import type { PostTagKind } from '$glitch';

  type TagInput = {
    name: string;
    kind: PostTagKind;
  };

  export let query = '';
  export let placeholder: string | undefined = undefined;
  export let tags: TagInput[] = [];
  export let kind: PostTagKind;
  export let label: string;
  export let tooltip: string = label;

  let formEl: HTMLFormElement;
  let postTags: TagInput[] | undefined = [];
  // let open = false;

  $: postTags = R.group(tags, (tag) => tag.kind)[kind];
</script>

<div>
  <p
    class={flex({
      gap: '4px',
      paddingTop: '4px',
      paddingBottom: '8px',
      fontSize: { base: '15px', sm: '14px' },
      fontWeight: { base: 'medium', sm: 'semibold' },
    })}
  >
    <span>{label}</span>
    <Tooltip style={center.raw()} message={tooltip} placement="top">
      <Icon style={css.raw({ color: 'gray.400' })} icon={IconAlertCircle} />
    </Tooltip>
  </p>

  <form
    bind:this={formEl}
    class={css({ position: 'relative' })}
    on:submit|preventDefault={() => {
      const escapedValue = query.trim().replace(/^#/, '').replaceAll(' ', '_');

      if (escapedValue.length === 0) return;

      if (tags.some((tag) => tag.name === escapedValue)) {
        toast('중복된 태그는 입력할 수 없어요');
        return;
      }

      if (!tagPattern.test(escapedValue)) {
        toast('허용되지 않은 문자를 태그로 입력했어요');
        return;
      }

      tags = [...tags, { kind, name: escapedValue }];

      // open = false;
      query = '';
    }}
    use:outsideClickEvent
  >
    <input
      class={css({
        borderRadius: '6px',
        paddingX: '16px',
        paddingY: '10px',
        fontSize: '14px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        width: 'full',
      })}
      {placeholder}
      type="search"
      bind:value={query}
      on:blur={() => {
        if (query.length > 0) {
          formEl.requestSubmit();
        }
      }}
    />
  </form>

  {#if postTags}
    <ul class={flex({ gap: '6px', wrap: 'wrap', paddingY: '10px' })}>
      {#each postTags as tag (tag.name)}
        <Chip on:click={() => (tags = tags.filter((t) => t.name !== tag.name))}>
          {tag.name}
        </Chip>
      {/each}
    </ul>
  {/if}
</div>
