<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import IconLetterSpacing from '~icons/effit/letter-spacing';
  import IconLineHeight from '~icons/effit/line-height';
  import IconRuby from '~icons/effit/ruby';
  import IconBold from '~icons/tabler/bold';
  import IconCheck from '~icons/tabler/check';
  import IconChevronDown from '~icons/tabler/chevron-down';
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import IconDotsVertical from '~icons/tabler/dots-vertical';
  import IconFolder from '~icons/tabler/folder';
  import IconHtml from '~icons/tabler/html';
  import IconItalic from '~icons/tabler/italic';
  import IconLink from '~icons/tabler/link';
  import IconList from '~icons/tabler/list';
  import IconListNumbers from '~icons/tabler/list-numbers';
  import IconMinus from '~icons/tabler/minus';
  import IconPhoto from '~icons/tabler/photo';
  import IconQuote from '~icons/tabler/quote';
  import IconSettings from '~icons/tabler/settings';
  import IconStrikethrough from '~icons/tabler/strikethrough';
  import IconUnderline from '~icons/tabler/underline';
  import Logo from '$assets/branding/logo.svg?component';
  import Wordmark from '$assets/icons/wordmark.svg?component';
  import { fragment, graphql } from '$glitch';
  import { Icon } from '$lib/components';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import { Menu, MenuItem } from '$lib/components/menu';
  import { createFloatingActions, portal } from '$lib/svelte/actions';
  import { values } from '$lib/tiptap/values';
  import { css, cx } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import CharacterCountWidget from './CharacterCountWidget.svelte';
  import { getEditorContext } from './context';
  import DraftListModal from './DraftListModal.svelte';
  import MobileEditMenu from './MobileEditMenu.svelte';
  import PublishMenu from './PublishMenu.svelte';
  import RevisionListModal from './RevisionListModal.svelte';
  import ToolbarButtonTooltip from './ToolbarButtonTooltip.svelte';
  import type { EditorPage_Header_post, EditorPage_Header_query } from '$glitch';

  export { _post as $post, _query as $query };
  let _query: EditorPage_Header_query;
  let _post: EditorPage_Header_post;

  const { store, state, forceSave } = getEditorContext();
  $: editor = $state.editor;

  $: query = fragment(
    _query,
    graphql(`
      fragment EditorPage_Header_query on Query {
        me @_required {
          id

          spaces {
            id
            name
            slug
            visibility

            icon {
              id
              ...Image_image
            }
          }

          posts(state: DRAFT) {
            id
          }

          ...EditorPage_DraftListModal_user
        }

        ...EditorPage_PublishMenu_query
      }
    `),
  );

  $: post = fragment(
    _post,
    graphql(`
      fragment EditorPage_Header_post on Post {
        id
        permalink
        state
        discloseStats
        hasPassword
        receiveFeedback
        receivePatronage
        receiveTagContribution
        protectContent
        visibility

        space {
          id
        }

        ...EditorPage_PublishMenu_post
        ...EditorPage_DraftListModal_post
        ...EditorPage_RevisionListModal_Post
      }
    `),
  );

  const menuOffset = 11;

  let colorPickerOpen = false;

  let contentOptionsOpen = false;
  let paragraphIndentOpen = false;
  let paragraphSpacingOpen = false;

  let publishMenuOpen = false;
  let revisionListOpen = false;
  let draftListOpen = false;

  const handleInsertFile = () => {
    const picker = document.createElement('input');
    picker.type = 'file';

    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];

      if (!file) {
        return;
      }

      editor?.chain().focus().setFile(file).run();
    });

    picker.showPicker();
  };

  const { anchor: colorPickerAnchor, floating: colorPickerFloating } = createFloatingActions({
    placement: 'bottom-end',
    offset: menuOffset,
  });

  const { anchor: publishAnchor, floating: publishFloating } = createFloatingActions({
    placement: 'bottom-end',
    offset: 11,
  });

  $: currentColor =
    (editor?.getAttributes('font_color').fontColor as string | undefined)?.toUpperCase() ?? values.defaultColor;

  let vvOffset: number | undefined;

  const handleVisualViewportChange = () => {
    vvOffset = window.visualViewport?.offsetTop;
  };

  onMount(() => {
    handleVisualViewportChange();

    window.visualViewport?.addEventListener('resize', handleVisualViewportChange);
    window.visualViewport?.addEventListener('scroll', handleVisualViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      window.visualViewport?.addEventListener('scroll', handleVisualViewportChange);
    };
  });
</script>

<header
  style:transform={`translateY(${vvOffset ?? 0}px)`}
  class={css({
    position: 'absolute',
    top: '0',
    width: 'full',
    backgroundColor: 'gray.5',
    transition: 'common',
    zIndex: '100',
  })}
>
  <div
    class={flex({
      justify: 'space-between',
      align: 'center',
      borderBottomWidth: '1px',
      borderBottomColor: 'gray.200',
      paddingX: '20px',
      width: 'full',
      height: '56px',
      sm: { paddingLeft: '28px' },
    })}
  >
    <a class={flex({ align: 'center', gap: '8px' })} href="/">
      <Logo class={css({ size: '24px', hideBelow: 'sm' })} />
      <Wordmark class={css({ height: '21px', color: 'gray.900', hideBelow: 'sm' })} />

      <Icon style={css.raw({ hideFrom: 'sm' })} icon={IconChevronLeft} size={24} />
    </a>

    <div class={flex({ flex: '1', justify: 'flex-end', align: 'flex-end' })}>
      <div class={flex({ direction: 'column', align: 'flex-end', marginRight: '12px', textAlign: 'right' })}>
        <CharacterCountWidget {editor} />

        <span
          class={css(
            { transition: 'common', fontSize: '10px' },
            !$state.isRevising && $state.lastRevision?.kind === 'MANUAL_SAVE'
              ? { fontWeight: 'semibold', color: 'teal.500' }
              : { color: 'gray.400' },
          )}
        >
          {#if $state.isRevising || !$state.lastRevision}
            {dayjs().formatAsTime()} 저장중
          {:else}
            {dayjs($state.lastRevision.updatedAt).formatAsTime()} 저장됨
          {/if}
        </span>
      </div>

      <div
        class={flex({
          align: 'center',
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderRadius: '4px',
          marginRight: '8px',
          paddingX: '14px',
          paddingY: '10px',
          fontSize: '14px',
          fontWeight: 'medium',
          lineHeight: 'none',
        })}
      >
        <button
          class={css({
            lineHeight: 'none',
            _after: {
              content: '""',
              borderRightWidth: '1px',
              borderRightColor: 'gray.300',
              marginLeft: '8px',
              height: '16px',
            },
          })}
          disabled={!$state.canRevise}
          type="button"
          on:click={() => forceSave()}
        >
          저장
        </button>

        <button
          class={css({
            paddingLeft: '8px',
            fontSize: '14px',
            fontWeight: 'semibold',
            color: 'gray.400',
            lineHeight: 'none',
          })}
          disabled={$query.me.posts.length === 0}
          type="button"
          on:click={() => (draftListOpen = true)}
        >
          {$query.me.posts?.length ?? 0}
        </button>
      </div>

      <div class={css({ width: 'fit' })} use:publishAnchor>
        <button
          class={css({
            borderWidth: '1px',
            borderColor: 'gray.900',
            borderRadius: '4px',
            paddingX: '32px',
            paddingY: '10px',
            fontSize: '14px',
            fontWeight: 'medium',
            color: 'gray.5',
            lineHeight: 'none',
            whiteSpace: 'nowrap',
            backgroundColor: 'gray.900',
            sm: { marginRight: '12px' },
          })}
          type="button"
          on:click={() => (publishMenuOpen = true)}
        >
          발행
        </button>
      </div>

      {#if publishMenuOpen}
        <div
          class={css({ position: 'fixed', inset: '0', zIndex: '40', smDown: { backgroundColor: 'gray.900/50' } })}
          role="button"
          tabindex="-1"
          on:click={() => (publishMenuOpen = false)}
          on:keypress={null}
          use:portal
        />
      {/if}

      <div
        class={css({ position: 'fixed', left: '0', bottom: '0', width: 'full', zIndex: '50', hideFrom: 'sm' })}
        use:portal
      >
        <PublishMenu {$post} {$query} bind:open={publishMenuOpen} />
      </div>

      <div class={css({ zIndex: '50', hideBelow: 'sm' })} use:publishFloating>
        <PublishMenu {$post} {$query} bind:open={publishMenuOpen} />
      </div>

      <Menu style={center.raw()} offset={menuOffset} placement="bottom-end" rounded={false}>
        <div slot="value" class={center({ height: '36px', hideBelow: 'sm' })}>
          <Icon icon={IconDotsVertical} size={24} />
        </div>

        <MenuItem on:click={() => (revisionListOpen = true)}>저장이력</MenuItem>
        <MenuItem external href={`/editor/${$post.permalink}/preview`} type="link">미리보기</MenuItem>
      </Menu>
    </div>
  </div>

  <div
    class={flex({
      align: 'center',
      borderBottomWidth: '1px',
      borderBottomColor: 'gray.200',
      paddingX: '24px',
      height: '56px',
      hideBelow: 'sm',
    })}
  >
    <div class={flex({ align: 'center', pointerEvents: 'auto' })}>
      <div
        class={center({
          gap: '12px',
          height: '34px',
          _after: {
            content: '""',
            borderRightWidth: '1px',
            borderRightColor: 'gray.300',
            marginRight: '12px',
            height: '16px',
          },
        })}
      >
        <ToolbarButtonTooltip message="글자 색">
          <button
            class={flex({
              align: 'center',
              gap: '4px',
              borderRadius: '4px',
              paddingLeft: '4px',
              paddingRight: '2px',
              height: '34px',
              _hover: { backgroundColor: 'gray.100' },
              _pressed: { backgroundColor: 'gray.100' },
            })}
            aria-pressed={colorPickerOpen}
            type="button"
            on:click={() => (colorPickerOpen = true)}
            use:colorPickerAnchor
          >
            <div style:background-color={currentColor} class={css({ borderRadius: 'full', size: '18px' })} />
            <Icon
              style={css.raw({ color: 'gray.300' }, colorPickerOpen && { rotate: '180deg' })}
              icon={IconChevronDown}
              size={20}
            />
          </button>

          {#if colorPickerOpen}
            <div
              class={css({ position: 'fixed', inset: '0', zIndex: '40' })}
              role="button"
              tabindex="-1"
              on:click={() => {
                colorPickerOpen = false;
                editor?.commands.focus();
              }}
              on:keypress={null}
              use:portal
            />
          {/if}

          <div class={css({ zIndex: '50' }, !colorPickerOpen && { display: 'none' })} use:colorPickerFloating>
            <ColorPicker
              hex={currentColor}
              on:input={(event) => {
                const { hex } = event.detail;
                if (hex === values.defaultColor) {
                  editor?.commands.unsetFontColor();
                } else {
                  editor?.commands.setFontColor(hex);
                }
              }}
            />
          </div>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="폰트">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={flex({
                justify: 'space-between',
                align: 'center',
                gap: '4px',
                borderRadius: '4px',
                paddingLeft: '4px',
                paddingRight: '2px',
                width: '144px',
                height: '34px',
                whiteSpace: 'nowrap',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <div>
                {values.fontFamily.find(({ value }) => editor?.getAttributes('font_family').fontFamily === value)
                  ?.label ?? values.fontFamily[0].label}
              </div>
              <Icon
                style={css.raw({ color: 'gray.300' }, open && { rotate: '180deg' })}
                icon={IconChevronDown}
                size={20}
              />
            </button>

            {#each values.fontFamily as font (font.value)}
              <MenuItem
                style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
                on:click={() => {
                  if (font.value === values.fontFamily[0].value) {
                    editor?.chain().focus().unsetFontFamily().run();
                  } else {
                    editor?.chain().focus().setFontFamily(font.value).run();
                  }
                }}
              >
                <span style:font-family={`PNXL_${font.value}`}>
                  {font.label}
                </span>
                <Icon
                  style={css.raw(
                    { color: 'teal.500' },
                    !editor?.isActive({ fontFamily: font.value }) && { visibility: 'hidden' },
                  )}
                  icon={IconCheck}
                  size={20}
                />
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="글자 크기">
          <Menu
            as="div"
            menuStyle={css.raw({ maxHeight: '312px', overflowY: 'auto' })}
            offset={menuOffset}
            placement="bottom"
            rounded={false}
          >
            <button
              slot="value"
              class={flex({
                justify: 'space-between',
                align: 'center',
                gap: '4px',
                borderRadius: '4px',
                paddingLeft: '4px',
                paddingRight: '2px',
                width: '64px',
                height: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              {values.fontSize.find(({ value }) => editor?.getAttributes('font_size').fontSize === value)?.label ??
                values.fontSize[4].label}
              <Icon
                style={css.raw({ color: 'gray.300' }, open && { rotate: '180deg' })}
                icon={IconChevronDown}
                size={20}
              />
            </button>

            {#each values.fontSize as fontSize (fontSize.value)}
              <MenuItem
                style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
                on:click={() => {
                  if (!editor) return;

                  if (fontSize.value === 16) {
                    editor.chain().focus().unsetFontSize().run();
                  } else {
                    editor.chain().focus().setFontSize(fontSize.value).run();
                  }
                }}
              >
                {fontSize.label}
                <Icon
                  style={css.raw(
                    { color: 'teal.500' },
                    !editor?.isActive({ fontSize: fontSize.value }) && { visibility: 'hidden' },
                  )}
                  icon={IconCheck}
                  size={20}
                />
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>
      </div>

      <div
        class={center({
          gap: '4px',
          _after: {
            content: '""',
            borderRightWidth: '1px',
            borderRightColor: 'gray.300',
            marginLeft: '8px',
            marginRight: '12px',
            height: '16px',
          },
        })}
      >
        <ToolbarButtonTooltip message="굵게">
          <button
            class={center({ size: '34px', borderRadius: '4px', _hover: { backgroundColor: 'gray.100' } })}
            type="button"
            on:click={() => editor?.chain().focus().toggleBold().run()}
          >
            <Icon style={css.raw(editor?.isActive('bold') && { color: 'teal.500' })} icon={IconBold} size={24} />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="기울임">
          <button
            class={center({ size: '34px', borderRadius: '4px', _hover: { backgroundColor: 'gray.100' } })}
            type="button"
            on:click={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Icon style={css.raw(editor?.isActive('italic') && { color: 'teal.500' })} icon={IconItalic} size={24} />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="취소선">
          <button
            class={center({ size: '34px', borderRadius: '4px', _hover: { backgroundColor: 'gray.100' } })}
            type="button"
            on:click={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Icon
              style={css.raw(editor?.isActive('strike') && { color: 'teal.500' })}
              icon={IconStrikethrough}
              size={24}
            />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="밑줄">
          <button
            class={center({ size: '34px', borderRadius: '4px', _hover: { backgroundColor: 'gray.100' } })}
            type="button"
            on:click={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Icon
              style={css.raw(editor?.isActive('underline') && { color: 'teal.500' })}
              icon={IconUnderline}
              size={24}
            />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="루비">
          <button
            class={center({ size: '34px', borderRadius: '4px', _hover: { backgroundColor: 'gray.100' } })}
            disabled={editor?.isActive('ruby') || editor?.state.selection.empty}
            type="button"
            on:click={() => editor?.chain().focus().setRuby('').run()}
          >
            <Icon icon={IconRuby} size={24} />
          </button>
        </ToolbarButtonTooltip>
      </div>

      <div
        class={center({
          gap: '4px',
          _after: {
            content: '""',
            borderRightWidth: '1px',
            borderRightColor: 'gray.300',
            marginLeft: '8px',
            marginRight: '12px',
            height: '16px',
          },
        })}
      >
        <ToolbarButtonTooltip message="정렬">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon
                icon={values.textAlign.find(({ value }) => value === editor?.getAttributes('paragraph').textAlign)
                  ?.icon ?? values.textAlign[0].icon}
                size={24}
              />
            </button>

            {#each values.textAlign as textAlign (textAlign.value)}
              <button
                class={center({
                  size: '34px',
                  _hover: { backgroundColor: 'gray.50' },
                  _pressed: { color: 'teal.500' },
                })}
                aria-pressed={editor?.isActive({ textAlign: textAlign.value })}
                type="button"
                on:click={() => editor?.chain().focus().setParagraphTextAlign(textAlign.value).run()}
              >
                <Icon icon={textAlign.icon} size={24} />
              </button>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="행간">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon icon={IconLineHeight} size={24} />
            </button>

            {#each values.lineHeight as lineHeight (lineHeight.value)}
              <MenuItem
                style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
                on:click={() => {
                  editor?.chain().focus().setParagraphLineHeight(lineHeight.value).run();
                }}
              >
                {lineHeight.label}
                <Icon
                  style={css.raw(
                    { color: 'teal.500' },
                    !editor?.isActive({ lineHeight: lineHeight.value }) && { visibility: 'hidden' },
                  )}
                  icon={IconCheck}
                  size={20}
                />
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="자간">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon icon={IconLetterSpacing} size={24} />
            </button>

            {#each values.letterSpacing as letterSpacing (letterSpacing.value)}
              <MenuItem
                style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
                on:click={() => {
                  editor?.chain().focus().setParagraphLetterSpacing(letterSpacing.value).run();
                }}
              >
                {letterSpacing.label}
                <Icon
                  style={css.raw(
                    { color: 'teal.500' },
                    !editor?.isActive({ letterSpacing: letterSpacing.value }) && { visibility: 'hidden' },
                  )}
                  icon={IconCheck}
                  size={20}
                />
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>
      </div>

      <div
        class={center({
          gap: '4px',
          _after: {
            content: '""',
            borderRightWidth: '1px',
            borderRightColor: 'gray.300',
            marginLeft: '8px',
            marginRight: '12px',
            height: '16px',
          },
        })}
      >
        <ToolbarButtonTooltip message="리스트">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon icon={IconList} size={24} />
            </button>

            <MenuItem
              on:click={() => {
                editor?.chain().focus().toggleBulletList().run();
              }}
            >
              <Icon icon={IconList} size={24} />
            </MenuItem>

            <MenuItem
              on:click={() => {
                editor?.chain().focus().toggleOrderedList().run();
              }}
            >
              <Icon icon={IconListNumbers} size={24} />
            </MenuItem>
          </Menu>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="구분선">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon icon={IconMinus} size={24} />
            </button>

            {#each values.horizontalRule as hr (hr.value)}
              <MenuItem
                style={center.raw({ gap: '8px' })}
                on:click={() => {
                  editor?.chain().focus().setHorizontalRule(hr.value).run();
                }}
              >
                <hr
                  class={cx('divider-preview', css({ width: '176px' }))}
                  aria-label={`${hr.value}번째 구분선`}
                  data-kind={hr.value}
                />
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="인용구">
          <Menu as="div" offset={menuOffset} placement="bottom" rounded={false}>
            <button
              slot="value"
              class={center({
                borderRadius: '4px',
                size: '34px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { backgroundColor: 'gray.100' },
              })}
              aria-pressed={open}
              type="button"
              let:open
            >
              <Icon icon={IconQuote} size={24} />
            </button>

            {#each values.blockquote as blockquote (blockquote.value)}
              <MenuItem
                style={center.raw({ gap: '8px' })}
                on:click={() => {
                  editor?.chain().focus().setBlockquote(blockquote.value).run();
                }}
              >
                <blockquote
                  class={cx('blockquote-preview', css({ color: 'gray.400', fontSize: '[12px!]' }))}
                  aria-label={`${blockquote.value}번째 인용구`}
                  data-kind={blockquote.value}
                >
                  내용을 입력해주세요
                </blockquote>
              </MenuItem>
            {/each}
          </Menu>
        </ToolbarButtonTooltip>
      </div>

      <div
        class={center({
          gap: '4px',
          _after: {
            content: '""',
            borderRightWidth: '1px',
            borderRightColor: 'gray.300',
            marginLeft: '8px',
            marginRight: '12px',
            height: '16px',
          },
        })}
      >
        <ToolbarButtonTooltip message="이미지">
          <button
            class={center({
              borderRadius: '4px',
              size: '34px',
              _hover: { backgroundColor: 'gray.100' },
            })}
            type="button"
            on:click={() => editor?.chain().focus().setGallery().run()}
          >
            <Icon icon={IconPhoto} size={24} />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="파일">
          <button
            class={center({
              borderRadius: '4px',
              size: '34px',
              _hover: { backgroundColor: 'gray.100' },
            })}
            type="button"
            on:click={handleInsertFile}
          >
            <Icon icon={IconFolder} size={24} />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="링크">
          <button
            class={center({
              borderRadius: '4px',
              size: '34px',
              _hover: { backgroundColor: 'gray.100' },
            })}
            disabled={editor?.isActive('link') || editor?.state.selection.empty}
            type="button"
            on:click={() => editor?.chain().focus().setLink('').run()}
          >
            <Icon icon={IconLink} size={24} />
          </button>
        </ToolbarButtonTooltip>

        <ToolbarButtonTooltip message="HTML">
          <button
            class={center({
              borderRadius: '4px',
              size: '34px',
              _hover: { backgroundColor: 'gray.100' },
            })}
            disabled={editor?.isActive('html')}
            type="button"
            on:click={() => editor?.chain().focus().setHtml().run()}
          >
            <Icon icon={IconHtml} size={24} />
          </button>
        </ToolbarButtonTooltip>
      </div>

      <ToolbarButtonTooltip message="본문 설정">
        <Menu as="div" offset={menuOffset} placement="bottom" rounded={false} bind:open={contentOptionsOpen}>
          <button
            slot="value"
            class={center({
              borderRadius: '4px',
              size: '34px',
              _hover: { backgroundColor: 'gray.100' },
              _pressed: { backgroundColor: 'gray.100' },
            })}
            aria-pressed={contentOptionsOpen}
            type="button"
          >
            <Icon icon={IconSettings} size={24} />
          </button>

          <Menu offset={16} placement="right-start" bind:open={paragraphIndentOpen}>
            <button
              slot="value"
              class={css({
                borderRadius: '8px',
                paddingX: '14px',
                paddingY: '12px',
                width: 'full',
                fontSize: '14px',
                _hover: { backgroundColor: 'teal.50', color: 'teal.600' },
              })}
              type="button"
              on:mouseenter={() => {
                paragraphIndentOpen = true;
                paragraphSpacingOpen = false;
              }}
            >
              문단 들여쓰기
            </button>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphIndentOpen = false;
                $store.paragraphIndent = 0;
              }}
            >
              없음
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphIndent !== 0 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphIndentOpen = false;
                paragraphIndentOpen = false;
                $store.paragraphIndent = 50;
              }}
            >
              0.5칸
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphIndent !== 50 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphIndentOpen = false;
                $store.paragraphIndent = 100;
              }}
            >
              1칸
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphIndent !== 100 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphIndentOpen = false;
                $store.paragraphIndent = 200;
              }}
            >
              2칸
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphIndent !== 200 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>
          </Menu>

          <Menu offset={16} placement="right-start" bind:open={paragraphSpacingOpen}>
            <button
              slot="value"
              class={css({
                borderRadius: '8px',
                paddingX: '14px',
                paddingY: '12px',
                width: 'full',
                fontSize: '14px',
                _hover: { backgroundColor: 'teal.50', color: 'teal.600' },
              })}
              type="button"
              on:mouseenter={() => {
                paragraphIndentOpen = false;
                paragraphSpacingOpen = true;
              }}
            >
              문단 사이간격
            </button>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphSpacingOpen = false;
                $store.paragraphSpacing = 0;
              }}
            >
              없음
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphSpacing !== 0 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphSpacingOpen = false;
                $store.paragraphSpacing = 50;
              }}
            >
              0.5줄
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphSpacing !== 50 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphSpacingOpen = false;
                $store.paragraphSpacing = 100;
              }}
            >
              1줄
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphSpacing !== 100 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>

            <MenuItem
              style={flex.raw({ justify: 'space-between', align: 'center', gap: '8px' })}
              on:click={() => {
                contentOptionsOpen = false;
                paragraphSpacingOpen = false;
                $store.paragraphSpacing = 200;
              }}
            >
              2줄
              <Icon
                style={css.raw({ color: 'teal.500' }, $store.paragraphSpacing !== 200 && { visibility: 'hidden' })}
                icon={IconCheck}
                size={20}
              />
            </MenuItem>
          </Menu>
        </Menu>
      </ToolbarButtonTooltip>
    </div>
  </div>

  <MobileEditMenu />
</header>

<DraftListModal {$post} $user={$query.me} bind:open={draftListOpen} />
<RevisionListModal {$post} bind:open={revisionListOpen} />

<style>
  .divider-preview {
    border-style: none;
    background-position: center;
    background-repeat: no-repeat;

    &[data-kind='1'] {
      background-image: linear-gradient(to right, currentColor 50%, rgb(255 255 255 / 0) 50%);
      background-repeat: repeat;
      background-size: 16px 1px;
      height: 0.0625rem;
    }

    &[data-kind='2'],
    &[data-kind='3'] {
      border: solid 1px currentColor;
      background-color: currentColor;
    }

    &[data-kind='3'] {
      width: 7.5rem;
    }

    &[data-kind='4'] {
      height: 1.8rem;
      background-image: url(https://pencil.so/horizontal-rules/4.svg);
    }

    &[data-kind='5'] {
      height: 0.875rem;
      background-image: url(https://pencil.so/horizontal-rules/5.svg);
    }

    &[data-kind='6'] {
      height: 0.91027rem;
      background-image: url(https://pencil.so/horizontal-rules/6.svg);
    }

    &[data-kind='7'] {
      height: 1.25rem;
      background-image: url(https://pencil.so/horizontal-rules/7.svg);
    }

    &[data-kind='8'] {
      height: 0.75rem;
      background-image: url(https://pencil.so/horizontal-rules/8.svg);
    }
  }

  .blockquote-preview {
    border-left-width: 3px;
    border-color: #09090b;
    padding-left: 6px;
    font-size: 9px;

    &[data-kind='2'] {
      &:before {
        display: block;
        width: 16px;
        content: url(https://pencil.so/blockquotes/carbon.svg);
      }
    }

    &[data-kind='3'] {
      border-left-style: none;
      &:before {
        display: block;
        width: 16px;
        margin-left: auto;
        margin-right: auto;
        content: url(https://pencil.so/blockquotes/carbon.svg);
      }
      &:after {
        display: block;
        width: 16px;
        margin-left: auto;
        margin-right: auto;
        transform: rotate(180deg);
        content: url(https://pencil.so/blockquotes/carbon.svg);
      }
    }
  }
</style>
