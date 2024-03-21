<script lang="ts">
  import qs from 'query-string';
  import IconChevronDown from '~icons/tabler/chevron-down';
  import IconFilter from '~icons/tabler/filter';
  import IconSearch from '~icons/tabler/search';
  import IconX from '~icons/tabler/x';
  import { page } from '$app/stores';
  import { Button, Icon, Modal, Tag } from '$lib/components';
  import { Radio } from '$lib/components/forms';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import { initSearchFilter } from './util';

  let showTagOption = true;
  let showAdultOption = true;
  // let showTriggerOption = true;
  let filterOpen = false;
  let includeValue = '';
  let excludeValue = '';
  let { includeTags, excludeTags, adultFilter, excludeContentFilters, orderBy } = initSearchFilter($page.url.search);

  // const contentFilters: ContentFilterCategory[] = [
  //   'GROSSNESS',
  //   'VIOLENCE',
  //   'CRIME',
  //   'CRUELTY',
  //   'PHOBIA',
  //   'GAMBLING',
  //   'TRAUMA',
  //   'HORROR',
  //   'INSULT',
  //   'OTHER',
  // ];

  const updateSearchFilter = () => {
    const stringifiedURL = qs.stringifyUrl(
      {
        url: '/search/post',
        query: {
          q: $page.url.searchParams.get('q'),
          include_tags: includeTags,
          exclude_tags: excludeTags,
          adult: adultFilter,
          exclude_triggers: excludeContentFilters,
          order_by: orderBy,
          page: 1,
        },
      },
      {
        skipNull: false,
      },
    );

    location.href = stringifiedURL;
  };
</script>

<div
  class={css({
    flexGrow: '1',
    maxWidth: '1200px',
    smDown: {
      paddingTop: '20px',
      width: 'full',
      backgroundColor: 'gray.5',
    },
    sm: {
      display: 'grid',
      gridTemplateColumns: '[2fr 7fr]',
      gap: '46px',
      marginX: '40px',
      marginY: '38px',
    },
  })}
>
  <aside class={css({ minWidth: '152px', maxWidth: '244px', hideBelow: 'sm' })}>
    <div
      class={css({
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '16px',
        paddingX: '12px',
        paddingY: '16px',
        backgroundColor: 'gray.5',
      })}
    >
      <button
        class={flex({ align: 'center', justify: 'space-between', gap: '10px', paddingY: '12px', width: 'full' })}
        type="button"
        on:click={() => (showTagOption = !showTagOption)}
      >
        <p class={css({ fontSize: '15px', fontWeight: 'bold', textAlign: 'left', width: 'full', maxWidth: '330px' })}>
          태그 옵션
        </p>
        <Icon
          style={css.raw({ color: 'gray.400' }, showTagOption && { transform: 'rotate(180deg)' })}
          icon={IconChevronDown}
          size={20}
        />
      </button>

      {#if showTagOption}
        <div class={css({ marginY: '16px' })}>
          <p class={css({ marginBottom: '8px', fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}>
            포함 태그
          </p>

          <form
            class={css({ position: 'relative', marginBottom: '12px', height: '46px', maxWidth: '330px' })}
            on:submit|preventDefault={() => {
              const escapedValue = includeValue.trim().replaceAll(' ', '_');

              if (escapedValue.length === 0) return;

              includeValue = '';

              if (!includeTags.includes(escapedValue)) {
                includeTags = [...includeTags, escapedValue];
                updateSearchFilter();
              }
            }}
          >
            <input
              class={css({
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '10px',
                paddingY: '8px',
                paddingLeft: '16px',
                paddingRight: '44px',
                fontSize: '14px',
                fontWeight: 'medium',
                height: '46px',
                width: 'full',
              })}
              type="text"
              bind:value={includeValue}
            />

            <button
              class={center({
                position: 'absolute',
                top: '0',
                bottom: '0',
                right: '14px',
                color: 'gray.500',
                height: 'full',
              })}
              type="submit"
            >
              <Icon style={css.raw({ transition: 'common' })} icon={IconSearch} size={20} />
            </button>
          </form>

          <div class={flex({ flexWrap: 'wrap', gap: '6px' })}>
            {#each includeTags as tag (tag)}
              <Tag
                style={css.raw({ width: 'fit', cursor: 'pointer' })}
                as="label"
                size="sm"
                on:change={() => {
                  includeTags = includeTags.filter((t) => t !== tag);

                  updateSearchFilter();
                }}
              >
                #{tag}
                <Icon slot="right-icon" icon={IconX} size={12} />
              </Tag>
            {/each}
          </div>

          <p
            class={css({
              marginTop: '16px',
              marginBottom: '8px',
              fontSize: '15px',
              fontWeight: 'semibold',
              color: 'gray.500',
            })}
          >
            제외 태그
          </p>

          <form
            class={css({ position: 'relative', marginTop: '12px', height: '46px', maxWidth: '330px' })}
            on:submit|preventDefault={() => {
              const escapedValue = excludeValue.trim().replaceAll(' ', '_');

              if (escapedValue.length === 0) return;

              if (!excludeTags.includes(escapedValue)) {
                excludeTags = [...excludeTags, escapedValue];
              }

              excludeValue = '';
              updateSearchFilter();
            }}
          >
            <input
              class={css({
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '10px',
                paddingY: '8px',
                paddingRight: '44px',
                paddingLeft: '16px',
                fontSize: '14px',
                fontWeight: 'medium',
                height: '46px',
                width: 'full',
              })}
              type="text"
              bind:value={excludeValue}
            />

            <button
              class={center({
                position: 'absolute',
                top: '0',
                bottom: '0',
                right: '14px',
                color: 'gray.500',
                height: 'full',
              })}
              type="submit"
            >
              <Icon style={css.raw({ transition: 'common' })} icon={IconSearch} size={20} />
            </button>
          </form>

          <div class={flex({ flexWrap: 'wrap', gap: '6px', marginTop: '12px' })}>
            {#each excludeTags as tag (tag)}
              <Tag
                style={css.raw({ width: 'fit', cursor: 'pointer' })}
                as="label"
                size="sm"
                on:change={() => {
                  excludeTags = excludeTags.filter((t) => t !== tag);
                  updateSearchFilter();
                }}
              >
                #{tag}
                <Icon slot="right-icon" icon={IconX} size={12} />
              </Tag>
            {/each}
          </div>
        </div>
      {/if}

      <hr class={css({ borderStyle: 'none', backgroundColor: 'gray.200', height: '1px' })} />

      <button
        class={flex({
          align: 'center',
          justify: 'space-between',
          gap: '10px',
          marginTop: '16px',
          paddingY: '12px',
          width: 'full',
        })}
        type="button"
        on:click={() => (showAdultOption = !showAdultOption)}
      >
        <p class={css({ fontSize: '15px', fontWeight: 'bold', textAlign: 'left', width: 'full', maxWidth: '330px' })}>
          성인물 옵션
        </p>

        <Icon
          style={css.raw({ color: 'gray.400' }, showAdultOption && { transform: 'rotate(180deg)' })}
          icon={IconChevronDown}
          size={20}
        />
      </button>

      {#if showAdultOption}
        <fieldset>
          <Radio
            style={css.raw({
              gap: '8px',
              marginTop: '8px',
              fontSize: '15px',
              fontWeight: 'semibold',
              color: 'gray.500',
            })}
            checked={adultFilter === null}
            on:change={() => {
              adultFilter = null;
              updateSearchFilter();
            }}
          >
            성인물 포함
          </Radio>
          <Radio
            style={css.raw({
              gap: '8px',
              marginTop: '8px',
              fontSize: '15px',
              fontWeight: 'semibold',
              color: 'gray.500',
            })}
            checked={adultFilter === false}
            on:change={() => {
              adultFilter = false;
              updateSearchFilter();
            }}
          >
            성인물 제외
          </Radio>
          <Radio
            style={css.raw({
              gap: '8px',
              marginTop: '8px',
              fontSize: '15px',
              fontWeight: 'semibold',
              color: 'gray.500',
            })}
            checked={adultFilter === true}
            on:change={() => {
              adultFilter = true;
              updateSearchFilter();
            }}
          >
            성인물만
          </Radio>
        </fieldset>
      {/if}
    </div>
  </aside>

  <div class={css({ sm: { maxWidth: '740px' } })}>
    <div class={flex({ align: 'center', justify: 'space-between', width: 'full', smDown: { paddingX: '16px' } })}>
      <h1 class={css({ flexGrow: '1', fontSize: '24px', fontWeight: 'bold' })}>검색결과</h1>

      <Button
        style={css.raw({ flexShrink: '0', marginX: '4px', hideFrom: 'sm' })}
        color="tertiary"
        size="md"
        variant="outlined"
        on:click={() => (filterOpen = true)}
      >
        <Icon icon={IconFilter} size={20} />
        필터
      </Button>

      <Menu as="div" placement="bottom">
        <Button slot="value" style={css.raw({ flexShrink: '0' })} color="tertiary" size="md" variant="outlined">
          {orderBy === 'LATEST' ? '최신순' : '정확도순'}
          <Icon icon={IconChevronDown} size={20} />
        </Button>

        <MenuItem
          on:click={() => {
            orderBy = 'LATEST';
            updateSearchFilter();
          }}
        >
          최신순
        </MenuItem>
        <MenuItem
          on:click={() => {
            orderBy = 'ACCURACY';
            updateSearchFilter();
          }}
        >
          정확도순
        </MenuItem>
      </Menu>
    </div>

    <slot />
  </div>
</div>

<Modal bind:open={filterOpen}>
  <svelte:fragment slot="title">검색 필터</svelte:fragment>

  <hr class={css({ borderStyle: 'none', marginBottom: '8px', backgroundColor: 'gray.200', height: '1px' })} />

  <div class={css({ overflowY: 'auto' })}>
    <button
      class={flex({ align: 'center', justify: 'space-between', gap: '10px', paddingY: '12px', width: 'full' })}
      type="button"
      on:click={() => (showTagOption = !showTagOption)}
    >
      <p class={css({ fontSize: '15px', textAlign: 'left', fontWeight: 'bold', width: 'full', maxWidth: '330px' })}>
        태그 옵션
      </p>
      <Icon
        style={css.raw({ color: 'gray.400' }, showTagOption && { transform: 'rotate(180deg)' })}
        icon={IconChevronDown}
        size={20}
      />
    </button>

    {#if showTagOption}
      <div class={css({ marginY: '16px' })}>
        <p class={css({ marginBottom: '8px', fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}>
          포함 태그
        </p>

        <form
          class={css({ position: 'relative', marginBottom: '12px', height: '46px', maxWidth: '330px' })}
          on:submit|preventDefault={() => {
            const escapedValue = includeValue.trim().replaceAll(' ', '_');

            if (escapedValue.length === 0) return;

            if (!includeTags.includes(escapedValue)) {
              includeTags = [...includeTags, escapedValue];
            }

            includeValue = '';
          }}
        >
          <input
            class={css({
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '10px',
              paddingY: '8px',
              paddingLeft: '16px',
              paddingRight: '44px',
              fontSize: '14px',
              fontWeight: 'medium',
              height: '46px',
              width: 'full',
            })}
            type="text"
            bind:value={includeValue}
          />

          <div
            class={center({
              position: 'absolute',
              top: '0',
              bottom: '0',
              right: '14px',
              color: 'gray.500',
              height: 'full',
            })}
          >
            <Icon style={css.raw({ transition: 'common' })} icon={IconSearch} size={20} />
          </div>
        </form>

        <div class={flex({ flexWrap: 'wrap', gap: '6px' })}>
          {#each includeTags as tag (tag)}
            <Tag
              style={css.raw({ width: 'fit' })}
              as="label"
              size="sm"
              on:change={() => {
                includeTags = includeTags.filter((t) => t !== tag);
              }}
            >
              #{tag}
              <Icon slot="right-icon" icon={IconX} size={12} />
            </Tag>
          {/each}
        </div>

        <p
          class={css({
            marginTop: '16px',
            marginBottom: '8px',
            fontSize: '15px',
            fontWeight: 'semibold',
            color: 'gray.500',
          })}
        >
          제외 태그
        </p>

        <form
          class={css({ position: 'relative', marginTop: '12px', height: '46px', maxWidth: '330px' })}
          on:submit|preventDefault={() => {
            const escapedValue = excludeValue.trim().replaceAll(' ', '_');

            if (escapedValue.length === 0) return;

            if (!excludeTags.includes(escapedValue)) {
              excludeTags = [...excludeTags, escapedValue];
            }

            excludeValue = '';
          }}
        >
          <input
            class={css({
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '10px',
              paddingY: '8px',
              paddingLeft: '16px',
              paddingRight: '44px',
              fontSize: '14px',
              fontWeight: 'medium',
              height: '46px',
              width: 'full',
            })}
            type="text"
            bind:value={excludeValue}
          />
          <div
            class={center({
              position: 'absolute',
              top: '0',
              bottom: '0',
              right: '14px',
              color: 'gray.500',
              height: 'full',
            })}
          >
            <Icon style={css.raw({ transition: 'common' })} icon={IconSearch} size={20} />
          </div>
        </form>

        <div class={flex({ flexWrap: 'wrap', gap: '6px', marginTop: '12px' })}>
          {#each excludeTags as tag (tag)}
            <Tag
              style={css.raw({ width: 'fit' })}
              as="label"
              size="sm"
              on:change={() => {
                excludeTags = excludeTags.filter((t) => t !== tag);
              }}
            >
              #{tag}
              <Icon slot="right-icon" icon={IconX} size={12} />
            </Tag>
          {/each}
        </div>
      </div>
    {/if}

    <hr class={css({ borderStyle: 'none', backgroundColor: 'gray.200', height: '1px' })} />

    <button
      class={flex({
        align: 'center',
        justify: 'space-between',
        gap: '10px',
        marginTop: '16px',
        paddingY: '12px',
        width: 'full',
      })}
      type="button"
      on:click={() => (showAdultOption = !showAdultOption)}
    >
      <p class={css({ fontSize: '15px', fontWeight: 'bold', textAlign: 'left', width: 'full', maxWidth: '330px' })}>
        성인물 옵션
      </p>
      <Icon
        style={css.raw({ color: 'gray.400' }, showAdultOption && { transform: 'rotate(180deg)' })}
        icon={IconChevronDown}
        size={20}
      />
    </button>

    {#if showAdultOption}
      <fieldset>
        <Radio
          style={css.raw({ gap: '8px', marginTop: '8px', fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}
          checked={adultFilter === null}
          on:change={() => {
            adultFilter = null;
          }}
        >
          성인물 포함
        </Radio>
        <Radio
          style={css.raw({ gap: '8px', marginTop: '8px', fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}
          checked={adultFilter === false}
          on:change={() => {
            adultFilter = false;
          }}
        >
          성인물 제외
        </Radio>
        <Radio
          style={css.raw({ gap: '8px', marginTop: '8px', fontSize: '15px', fontWeight: 'semibold', color: 'gray.500' })}
          checked={adultFilter === true}
          on:change={() => {
            adultFilter = true;
          }}
        >
          성인물만
        </Radio>
      </fieldset>
    {/if}

    <div class={flex({ gap: '12px', marginTop: '16px' })}>
      <Button
        style={css.raw({ flexGrow: '1' })}
        color="tertiary"
        size="xl"
        variant="outlined"
        on:click={() => {
          includeValue = '';
          excludeValue = '';
          includeTags = [];
          excludeTags = [];
          adultFilter = null;
          excludeContentFilters = [];
          orderBy = 'LATEST';
        }}
      >
        초기화
      </Button>
      <Button
        style={css.raw({ flexGrow: '3' })}
        size="xl"
        on:click={() => {
          filterOpen = false;
          updateSearchFilter();
        }}
      >
        결과보기
      </Button>
    </div>
  </div>
</Modal>
