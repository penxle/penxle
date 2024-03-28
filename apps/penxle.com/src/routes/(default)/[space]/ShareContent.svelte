<script lang="ts">
  import IconArrowBarToDown from '~icons/tabler/arrow-bar-to-down';
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import IconDots from '~icons/tabler/dots';
  import { browser } from '$app/environment';
  import { graphql } from '$glitch';
  import { Icon } from '$lib/components';
  import { RingSpinner } from '$lib/components/spinners';
  import { Button, Modal } from '$lib/components/v2';
  import { toast } from '$lib/notification';
  import { dataurl2file } from '$lib/utils';
  import { css, cx } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';

  export let open = false;
  export let body: string;

  export let title: string;
  export let spaceName: string;

  let showShareTargetMenu = false;

  const fontFamilies = [
    { label: '프리텐타드', value: 'PNXL_Pretendard' },
    { label: '리디바탕', value: 'PNXL_RIDIBatang' },
  ] as const;
  let fontFamily: (typeof fontFamilies)[number]['value'] = fontFamilies[0].value;

  const fontSizes = [
    { label: '작은글씨', value: '12px' },
    { label: '중간글씨', value: '16px' },
    { label: '큰글씨', value: '20px' },
  ] as const;
  let fontSize: (typeof fontSizes)[number]['value'] = fontSizes[1].value;

  const backgroundColors = [
    '#FFFFFF',
    '#D4D4D8',
    '#18181B',
    '#115E59',
    '#1E3A8A',
    '#4C1D95',
    '#9F1239',
    '#F66062',
    '#A16207',
  ] as const;

  let backgroundColor: (typeof backgroundColors)[number] = backgroundColors[0];

  const textColorFromBackgroundColor = {
    [backgroundColors[0]]: '#09090B',
    [backgroundColors[1]]: '#09090B',
    [backgroundColors[2]]: '#FFFFFF',
    [backgroundColors[3]]: '#FFFFFF',
    [backgroundColors[4]]: '#FFFFFF',
    [backgroundColors[5]]: '#FFFFFF',
    [backgroundColors[6]]: '#FFFFFF',
    [backgroundColors[7]]: '#FFFFFF',
    [backgroundColors[8]]: '#FFFFFF',
  } as const;

  $: color = textColorFromBackgroundColor[backgroundColor];

  let showSpinner = false;
  let generatedPostShareImage: string | null = null;

  const generatePostShareImage = graphql(`
    mutation ShareContent_GeneratePostShareImage_Mutation($input: GeneratePostShareImageInput!) {
      generatePostShareImage(input: $input)
    }
  `);

  $: if (browser && backgroundColor && fontFamily && fontSize) {
    handleShare();
  }

  const handleShare = async () => {
    const fontFamilyToInputFormat = {
      PNXL_Pretendard: 'Pretendard',
      PNXL_RIDIBatang: 'RIDIBatang',
    } as const satisfies Record<(typeof fontFamilies)[number]['value'], string>;

    const fontSizeToInputFormat = {
      '12px': 'small',
      '16px': 'medium',
      '20px': 'large',
    } as const satisfies Record<(typeof fontSizes)[number]['value'], string>;

    showSpinner = true;

    try {
      generatedPostShareImage = await generatePostShareImage({
        title,
        space: spaceName,
        body,
        background: backgroundColor,
        color,
        font: fontFamilyToInputFormat[fontFamily],
        size: fontSizeToInputFormat[fontSize],
      });
    } catch (err) {
      toast('이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');

      // 더미 값 할당으로 무한 루프를 방지함
      generatedPostShareImage = '';

      throw err;
    }
    showSpinner = false;
  };

  const download = () => {
    if (!generatedPostShareImage) throw new Error('이미지가 생성되지 않았습니다.');
    const link = document.createElement('a');
    link.download = `${title} | ${spaceName}.png`;
    link.href = generatedPostShareImage;
    link.click();
  };

  const share = () => {
    if (!generatedPostShareImage) throw new Error('이미지가 생성되지 않았습니다.');
    const file = dataurl2file(generatedPostShareImage, `${title} | ${spaceName}.png`);
    navigator.share({ title, text: '밑줄 이미지 공유', files: [file] });
  };

  const shareTargetMenuButtonWarpClassname = css({
    'position': 'relative',
    'display': 'flex',
    'flexDirection': 'column',
    'alignItems': 'center',
    'gap': '6px',

    '& > button': {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      size: '64px',
      color: 'gray.500',
      backgroundColor: 'gray.50',
    },

    '& > label': {
      fontSize: '13px',
      fontWeight: 'medium',
      _after: {
        content: '""',
        position: 'absolute',
        inset: '0',
        cursor: 'pointer',
      },
    },
  });
</script>

<Modal
  style={css.raw({ maxWidth: 'screen' })}
  actionStyle={css.raw(showShareTargetMenu && { visibility: 'hidden' })}
  titleStyle={css.raw({ justifyContent: 'center', marginX: '32px' })}
  bind:open
>
  <button
    slot="title-left"
    class={css({
      position: 'absolute',
      left: '0',
      paddingX: '24px',
      transition: 'opacity',
      _disabled: { opacity: '0', visibility: 'hidden' },
    })}
    disabled={!showShareTargetMenu}
    type="button"
    on:click={() => (showShareTargetMenu = false)}
  >
    <Icon icon={IconChevronLeft} size={24} />
  </button>
  <svelte:fragment slot="title">밑줄 이미지 편집</svelte:fragment>
  <form id="share-content-as-image" class={flex({ direction: 'column' })}>
    <article
      class={css({
        position: 'relative',
        marginX: '20px',
        marginTop: '20px',
        marginBottom: '16px',
        borderWidth: '1px',
        borderColor: backgroundColor === '#FFFFFF' ? '[gray.900/10]' : 'transparent',
        alignSelf: 'center',
        size: 'full',
        maxSize: '398px',
        aspectRatio: '[1/1]',
      })}
    >
      <img
        class={css({ size: 'full' })}
        alt="밑줄 이미지 미리보기"
        src={generatedPostShareImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"}
      />

      {#if showSpinner}
        <div class={center({ position: 'absolute', inset: '0', paddingX: '16px', paddingY: '8px' })}>
          <RingSpinner style={css.raw({ size: '80px', color: 'teal.400', opacity: '80' })} />
        </div>
      {/if}
    </article>

    <div class={css({ position: 'relative' })}>
      <section
        class={css(
          {
            position: 'absolute',
            inset: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            borderTopWidth: '[8px]',
            borderTopColor: 'gray.100',
            paddingTop: '92px',
            size: 'full',
            backgroundColor: 'gray.5',
            transition: 'opacity',
          },
          !showShareTargetMenu && { opacity: '0', visibility: 'hidden', zIndex: '-1' },
        )}
      >
        <div class={shareTargetMenuButtonWarpClassname}>
          <button id="download-share-button" type="button" on:click={download}>
            <Icon icon={IconArrowBarToDown} size={32} />
          </button>
          <label for="download-share-button">이미지 저장</label>
        </div>
        <div class={shareTargetMenuButtonWarpClassname}>
          <button
            id="etc-share-button"
            class={cx('peer', css({ _disabled: { color: 'gray.300' } }))}
            disabled={typeof navigator !== 'undefined' && !navigator.share}
            type="button"
            on:click={share}
          >
            <Icon icon={IconDots} size={32} />
          </button>
          <label class={css({ _peerDisabled: { color: 'gray.300' } })} for="etc-share-button">기타</label>
        </div>
      </section>
      <section class={flex({ gap: '8px', paddingX: '20px', paddingY: '8px', overflowX: 'auto', scrollbar: 'hidden' })}>
        {#each backgroundColors as bgColor (bgColor)}
          <label>
            <input
              name="backgroundColorClassname"
              class={cx('peer', css({ appearance: 'none' }))}
              type="radio"
              value={bgColor}
              bind:group={backgroundColor}
            />
            <div
              style:background={bgColor}
              class={css(
                {
                  borderRadius: '3px',
                  size: '46px',
                  zIndex: '-1',
                  _peerChecked: { borderWidth: '2px', borderColor: 'teal.500' },
                },
                bgColor === '#FFFFFF' && { borderWidth: '1px', borderColor: 'gray.200' },
              )}
            />
          </label>
        {/each}
      </section>
      <section class={flex({ align: 'center', gap: '16px', paddingX: '20px', paddingY: '14px' })} role="group">
        {#each fontFamilies as family (family)}
          <button
            style:font-family={family.value}
            class={css({
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '3px',
              paddingX: '5px',
              height: '34px',
              _hover: { backgroundColor: 'gray.100' },
              _focus: { backgroundColor: 'gray.100' },
              _pressed: { color: 'teal.500' },
            })}
            aria-pressed={fontFamily === family.value}
            type="button"
            on:click={() => (fontFamily = family.value)}
          >
            {family.label}
          </button>
        {/each}
      </section>
      <section
        class={flex({
          align: 'center',
          gap: '16px',
          borderYWidth: '1px',
          borderYColor: 'gray.200',
          paddingX: '20px',
          paddingY: '14px',
        })}
        role="group"
      >
        {#each fontSizes as size (size)}
          <button
            style:font-size={size.value}
            class={css({
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '3px',
              paddingX: '5px',
              height: '34px',
              _hover: { backgroundColor: 'gray.100' },
              _focus: { backgroundColor: 'gray.100' },
              _pressed: { fontWeight: 'bold', color: 'teal.500' },
            })}
            aria-pressed={fontSize === size.value}
            type="button"
            on:click={() => (fontSize = size.value)}
          >
            {size.label}
          </button>
        {/each}
      </section>
    </div>
  </form>

  <Button
    slot="action"
    style={css.raw({ flex: '1', marginTop: '16px' })}
    disabled={generatedPostShareImage === null}
    size="lg"
    on:click={() => (showShareTargetMenu = true)}
  >
    공유
  </Button>
</Modal>
