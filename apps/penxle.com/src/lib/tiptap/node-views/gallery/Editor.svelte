<script lang="ts">
  import './driver.css';

  import { Semaphore } from 'async-mutex';
  import { driver as driverFn } from 'driver.js';
  import ky from 'ky';
  import { nanoid } from 'nanoid';
  import * as R from 'radash';
  import Sortable from 'sortablejs';
  import { onDestroy, tick } from 'svelte';
  import IconBookBothPage from '~icons/effit/book-both-page';
  import IconBookSinglePage from '~icons/effit/book-single-page';
  import IconContentScroll from '~icons/effit/content-scroll';
  import IconContentSlide from '~icons/effit/content-slide';
  import IconGrid from '~icons/effit/grid';
  import IconGrid2Columns from '~icons/effit/grid-2-columns';
  import IconGrid3Columns from '~icons/effit/grid-3-columns';
  import IconAlertCircle from '~icons/tabler/alert-circle';
  import IconChevronLeft from '~icons/tabler/chevron-left';
  import IconGripVertical from '~icons/tabler/grip-vertical';
  import IconLayoutGrid from '~icons/tabler/layout-grid';
  import IconList from '~icons/tabler/list';
  import IconPhoto from '~icons/tabler/photo';
  import IconPhotoUp from '~icons/tabler/photo-up';
  import IconPlus from '~icons/tabler/plus';
  import IconTrash from '~icons/tabler/trash';
  import { graphql } from '$glitch';
  import { Icon, Tooltip } from '$lib/components';
  import { Checkbox, Switch } from '$lib/components/forms';
  import { Button, Modal } from '$lib/components/v2';
  import { isValidImageFile, persisted, validImageMimes } from '$lib/utils';
  import { css, cx } from '$styled-system/css';
  import { center, flex, grid } from '$styled-system/patterns';
  import Display from './Display.svelte';
  import IsomorphicImage from './IsomorphicImage.svelte';
  import RadioGroup from './RadioGroup.svelte';
  import type { Image_image } from '$glitch';
  import type { NodeViewProps } from '$lib/tiptap';

  export let open = false;

  export let node: NodeViewProps['node'];
  export let updateAttributes: NodeViewProps['updateAttributes'];

  if (node.attrs.layout === 'initial') {
    updateAttributes({ layout: 'standalone' });
  }

  let sortable: Sortable;

  let sortableContainer: HTMLElement;
  let sortableGallery: HTMLElement;

  const reorderArray = (arr: (string | IsomorphicImage)[], newIndex: number, oldIndex: number) => {
    const draggedItem = arr[oldIndex];

    if (oldIndex > newIndex) {
      arr = [...arr.slice(0, newIndex), draggedItem, ...arr.slice(newIndex, oldIndex), ...arr.slice(oldIndex + 1)];
    } else {
      arr = [
        ...arr.slice(0, oldIndex),
        ...arr.slice(oldIndex + 1, newIndex + 1),
        draggedItem,
        ...arr.slice(newIndex + 1),
      ];
    }

    return arr;
  };

  let sortableOptions: Sortable.Options = {
    scroll: true,
    handle: '.image',
    animation: 150,
    delay: 50,
    forceAutoScrollFallback: true,
    scrollSensitivity: 60,
    scrollSpeed: 10,
    bubbleScroll: true,
    onMove: (evt) => {
      if (evt.related.className.includes('prevent-dragging')) {
        return false;
      }
    },
    onEnd: ({ newIndex, oldIndex }) => {
      if (newIndex === undefined || oldIndex === undefined) return;

      const reorderedData = reorderArray(node.attrs.__data, newIndex, oldIndex);

      updateAttributes({ __data: reorderedData });
    },
  };

  $: if (sortableContainer) {
    sortable = Sortable.create(sortableContainer, sortableOptions);
  }

  $: if (sortableGallery) {
    sortable = Sortable.create(sortableGallery, sortableOptions);
  }

  const prepareImageUpload = graphql(`
    mutation TiptapGallery_PrepareImageUpload_Mutation {
      prepareImageUpload {
        key
        presignedUrl
      }
    }
  `);

  const finalizeImageUpload = graphql(`
    mutation TiptapGallery_FinalizeImageUpload_Mutation($input: FinalizeImageUploadInput!) {
      finalizeImageUpload(input: $input) {
        id
        name
        color
        ...Image_image
      }
    }
  `);

  type IsomorphicImage = { id: string } & (
    | { kind: 'file'; __file: File }
    | { kind: 'data'; __data: { id: string; name: string } & Image_image }
  );

  $: updateAttributes({
    ids: node.attrs.__data.filter((i: IsomorphicImage) => i.kind === 'data').map((i: IsomorphicImage) => i.id),
  });

  let imageListOpen = false;
  let selectedImages: string[] = [];
  let selectedImageName: string | undefined;

  $: if (selectedImages.length > 0) {
    const selectedNode = node.attrs.__data.find((i: IsomorphicImage) => i.id === selectedImages[0]);
    selectedImageName = selectedNode?.kind === 'data' ? selectedNode.__data.name : selectedNode?.__file.name;
  }

  $: allSelected =
    node.attrs.__data.length > 0 &&
    R.diff(
      node.attrs.__data.map((i: IsomorphicImage) => i.id),
      selectedImages,
    ).length === 0;

  let view: 'grid' | 'list' = 'grid';

  let visited = persisted('gallery-editor-visited', false);

  let onboardingAnchorElement1: HTMLElement | undefined;
  let onboardingAnchorElement2: HTMLElement | undefined;
  const onboardingAnchorLastDynamicId = 'image-list-view-first-item';

  let driver: ReturnType<typeof driverFn> | undefined;

  async function startDrive() {
    await tick();

    if (!onboardingAnchorElement1 || !onboardingAnchorElement2)
      throw new Error('onboardingAnchorElements is not ready');

    driver = driverFn({
      steps: [
        {
          element: onboardingAnchorElement1,
          popover: {
            popoverClass: 'onboarding-popover step-1',
            description: '이미지를 <mark>드래그해서 놓으면</mark> 순서를 변경할 수 있어요',
          },
        },
        {
          element: onboardingAnchorElement2,
          popover: {
            popoverClass: 'onboarding-popover step-2',
            description: '전체목록을 클릭하면 <mark>여러 장의 이미지를 편집</mark>할 수 있어요',
            onNextClick: async () => {
              imageListOpen = true;
              await tick();
              driver?.moveNext();
            },
          },
        },
        {
          element: '#' + onboardingAnchorLastDynamicId,
          popover: {
            popoverClass: 'onboarding-popover step-3',
            description: '이미지 편집과 동일하게 <mark>드래그해서 놓으면</mark> 순서를 변경할 수 있어요',
            onPrevClick: async () => {
              imageListOpen = false;
              await tick();
              driver?.movePrevious();
            },
          },
        },
      ],
      showProgress: true,
      showButtons: ['previous', 'next'],
      overlayOpacity: 0.2,
      stagePadding: 0,
      stageRadius: 4,
      prevBtnText: '이전',
      nextBtnText: '다음',
      doneBtnText: '완료',
      progressText: '<mark>{{current}}</mark><span class="divider">/</span>{{total}}',
    });

    driver.drive();

    // eslint-disable-next-line svelte/infinite-reactive-loop
    $visited = true;
  }

  $: firstIsomorphicImageIsUploading = node.attrs.__data.length > 0 && node.attrs.__data[0].kind === 'data';
  $: if (open && !$visited && firstIsomorphicImageIsUploading) {
    // eslint-disable-next-line svelte/infinite-reactive-loop, unicorn/prefer-top-level-await
    startDrive();
  }

  onDestroy(() => {
    if (driver) {
      driver.destroy();
    }

    if (sortable) {
      sortable.destroy();
    }
  });

  const semaphore = new Semaphore(20);

  const upload = async (file: File) => {
    return await semaphore.runExclusive(async () => {
      const { key, presignedUrl } = await prepareImageUpload();
      await ky.put(presignedUrl, { body: file });
      return await finalizeImageUpload({ key, name: file.name });
    });
  };

  const handleInsertImage = () => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = validImageMimes.join(',');
    picker.multiple = true;

    picker.addEventListener('change', async () => {
      const files = picker.files;

      if (!files) {
        return;
      }

      const images: IsomorphicImage[] = [];
      for (const file of files) {
        if (!(await isValidImageFile(file))) {
          continue;
        }

        const id = nanoid();
        images.push({ id, kind: 'file', __file: file });
      }

      await updateAttributes((attrs) => ({
        __data: [...attrs.__data, ...images],
      }));

      for (const image of images) {
        if (image.kind !== 'file') {
          continue;
        }

        upload(image.__file).then((resp) => {
          updateAttributes((attrs) => ({
            __data: attrs.__data.map((i: IsomorphicImage) =>
              i.id === image.id ? { id: resp.id, kind: 'data', __data: resp } : i,
            ),
          }));
        });
      }
    });

    picker.showPicker();
  };

  const removeImage = async (id: string) => {
    await updateAttributes((attrs) => ({
      __data: attrs.__data.filter((i: IsomorphicImage) => i.id !== id),
    }));
    selectedImages = selectedImages.filter((i) => i !== id);
  };

  const removeImages = async (ids: string[]) => {
    await updateAttributes((attrs) => ({
      __data: attrs.__data.filter((i: IsomorphicImage) => !ids.includes(i.id)),
    }));
    selectedImages = selectedImages.filter((i) => !ids.includes(i));
  };
</script>

<Modal size="lg" on:close={() => (open = false)} bind:open>
  <svelte:fragment slot="title">
    이미지 편집
    <Tooltip
      style={flex.raw({ align: 'center', marginLeft: '4px' })}
      message="이미지는 무제한으로 추가할 수 있으며, 하단에 있는 이미지를 드래그해서 놓으면 순서를 변경할 수 있어요"
      offset={10}
      placement="bottom-start"
    >
      <Icon style={css.raw({ color: 'gray.400' })} icon={IconAlertCircle} />
    </Tooltip>
  </svelte:fragment>

  <div class={flex({ height: '470px' })}>
    <div class={flex({ flexDirection: 'column', width: '562px' })}>
      <div
        class={flex({
          flexDirection: 'column',
          align: 'center',
          flexGrow: '1',
          paddingTop: '24px',
          paddingBottom: '16px',
          overflowY: 'auto',
        })}
      >
        <div class={center({ flexDirection: 'column', flexGrow: '1', width: '400px' })}>
          {#if node.attrs.ids.length === 0}
            <button
              class={center({
                flexDirection: 'column',
                gap: '10px',
                borderWidth: '1px',
                borderColor: 'gray.300',
                borderStyle: 'dashed',
                color: 'gray.300',
                backgroundColor: 'gray.50',
                width: '400px',
                height: '300px',
              })}
              type="button"
              on:click={handleInsertImage}
            >
              <Icon icon={IconPhotoUp} size={32} />
              <p class={css({ fontSize: '13px', fontWeight: 'medium' })}>이미지를 업로드해주세요</p>
            </button>
          {/if}

          <div class={css({ width: '400px' }, node.attrs.layout === 'standalone' && { gap: '24px' })}>
            <Display deletable {node} {updateAttributes} />
          </div>
        </div>
      </div>

      <button
        bind:this={onboardingAnchorElement2}
        class={flex({
          zIndex: '1',
          flexShrink: '1',
          alignSelf: 'flex-end',
          borderWidth: '1px',
          borderBottomStyle: 'none',
          borderColor: 'gray.200',
          borderTopRadius: '4px',
          marginRight: '16px',
          paddingX: '8px',
          paddingY: '6px',
          color: 'gray.400',
          backgroundColor: 'gray.5',
        })}
        type="button"
        on:click={() => {
          imageListOpen = true;
        }}
      >
        <Icon icon={IconLayoutGrid} />
        <span class={css({ marginLeft: '6px', fontSize: '11px', fontWeight: 'semibold' })}>전체목록</span>
      </button>
      <div
        class={flex({
          position: 'relative',
          borderTopWidth: '1px',
          borderColor: 'gray.200',
          paddingX: '24px',
          height: '104px',
        })}
      >
        <ul
          bind:this={sortableContainer}
          class={flex({
            flexGrow: '1',
            gap: '4px',
            paddingX: '10px',
            paddingY: '14px',
            overflowX: 'auto',
            overflowY: 'hidden',
          })}
        >
          {#each node.attrs.__data as image, index (image.id)}
            <li class={cx('image', css({ position: 'relative', flex: 'none' }))} data-id={image.id}>
              <button
                class={flex({
                  'position': 'relative',
                  'flex': 'none',
                  'flexDirection': 'column',
                  'gap': '4px',
                  'borderRadius': '4px',
                  'padding': '4px',
                  '_hover': { backgroundColor: 'gray.200' },
                  '_pressed': { ringWidth: '[1.5px]', ringColor: 'teal.500', backgroundColor: 'teal.50' },
                  '& > div': { _pressed: { display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                })}
                aria-pressed={selectedImages.includes(image.id)}
                type="button"
                on:click={() => {
                  selectedImages = selectedImages.includes(image.id)
                    ? selectedImages.filter((id) => id !== image.id)
                    : [...selectedImages, image.id];
                }}
              >
                <IsomorphicImage style={css.raw({ borderRadius: '3px', size: '48px', objectFit: 'cover' })} {image} />
                <div
                  class={css({
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    display: 'none',
                    borderRadius: '3px',
                    backgroundColor: 'gray.900/30',
                    size: '48px',
                  })}
                >
                  <button type="button" on:click={() => removeImage(image.id)}>
                    <Icon style={css.raw({ color: 'gray.5' })} icon={IconTrash} size={20} />
                  </button>
                </div>
                <p class={css({ fontSize: '10px', color: 'gray.400', textAlign: 'center', width: 'full' })}>
                  {index + 1}
                </p>
              </button>
              {#if index === 0}
                <div
                  bind:this={onboardingAnchorElement1}
                  class={css({ position: 'absolute', inset: '0', zIndex: '-1' })}
                />
              {/if}
            </li>
          {/each}

          <li class="prevent-dragging">
            <button
              class={flex({ flexDirection: 'column', gap: '4px', borderRadius: '4px', padding: '4px' })}
              type="button"
              on:click={handleInsertImage}
            >
              <div class={center({ borderRadius: '3px', backgroundColor: 'gray.100', size: '48px' })}>
                <Icon style={css.raw({ color: 'gray.400' })} icon={IconPlus} />
              </div>

              <p class={css({ fontSize: '10px', color: 'gray.400', textAlign: 'center', width: 'full' })}>
                이미지 추가
              </p>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div
      class={flex({
        flexDirection: 'column',
        flexGrow: '1',
        gap: '16px',
        borderLeftWidth: '1px',
        borderColor: 'gray.200',
        paddingY: '20px',
        paddingLeft: '20px',
        paddingRight: '24px',
      })}
    >
      <div>
        <p class={css({ marginBottom: '10px', fontSize: '13px', fontWeight: 'medium' })}>레이아웃</p>

        <RadioGroup
          name="layout"
          style={grid.raw({
            gridTemplateColumns: '2',
            gridTemplateRows: '2',
            borderBottomWidth: '1px',
            borderColor: 'gray.100',
            paddingBottom: '16px',
          })}
          items={[
            {
              label: '개별',
              value: 'standalone',
              icon: IconPhoto,
              checked: node.attrs.layout === 'standalone',
            },
            { label: '그리드', value: 'grid', icon: IconGrid, checked: node.attrs.layout === 'grid' },
            {
              label: '슬라이드',
              value: 'slide',
              icon: IconContentSlide,
              checked: node.attrs.layout === 'slide',
            },
            { label: '스크롤', value: 'scroll', icon: IconContentScroll, checked: node.attrs.layout === 'scroll' },
          ]}
          size="sm"
          on:change={(v) => updateAttributes({ layout: v.detail })}
        />
      </div>

      {#if node.attrs.layout === 'grid'}
        <div>
          <p class={css({ marginBottom: '10px', fontSize: '13px', fontWeight: 'medium' })}>열</p>

          <RadioGroup
            name="column"
            style={css.raw({ borderBottomWidth: '1px', borderColor: 'gray.100', paddingBottom: '16px' })}
            items={[
              {
                label: '2열',
                value: 2,
                icon: IconGrid2Columns,
                checked: node.attrs.gridColumns === 2,
              },
              { label: '3열', value: 3, icon: IconGrid3Columns, checked: node.attrs.gridColumns === 3 },
            ]}
            variant="icon-list"
            on:change={(v) => updateAttributes({ gridColumns: v.detail })}
          />
        </div>
      {/if}

      {#if node.attrs.layout === 'slide'}
        <div>
          <p class={css({ marginBottom: '10px', fontSize: '13px', fontWeight: 'medium' })}>보기</p>

          <RadioGroup
            name="view"
            style={css.raw({ borderBottomWidth: '1px', borderColor: 'gray.100', paddingBottom: '16px' })}
            items={[
              {
                label: '한 쪽 보기',
                value: 1,
                icon: IconBookSinglePage,
                checked: node.attrs.slidesPerPage === 1,
              },
              { label: '두 쪽 보기', value: 2, icon: IconBookBothPage, checked: node.attrs.slidesPerPage === 2 },
            ]}
            variant="icon-list"
            on:change={(v) => updateAttributes({ slidesPerPage: v.detail })}
          />
        </div>
      {/if}

      {#if node.attrs.layout !== 'standalone'}
        <div>
          <p class={css({ marginBottom: '10px', fontSize: '13px', fontWeight: 'medium' })}>간격 설정</p>

          <Switch
            name="space"
            checked={node.attrs.spacing}
            on:change={() => updateAttributes({ spacing: !node.attrs.spacing })}
          />
        </div>
      {/if}
    </div>
  </div>

  <svelte:fragment slot="action">
    <Button style={css.raw({ width: '95px' })} size="lg" on:click={() => (open = false)}>닫기</Button>
  </svelte:fragment>
</Modal>

<Modal size="lg" bind:open={imageListOpen}>
  <svelte:fragment slot="title">
    <button class={css({ marginRight: '4px' })} type="button" on:click={() => (imageListOpen = false)}>
      <Icon icon={IconChevronLeft} size={24} />
    </button>
    전체목록
    <Tooltip
      style={center.raw({ marginLeft: '4px' })}
      message="원하는 순서에 이미지를 드래그해서 놓으면 순서를 변경할 수 있어요"
      offset={10}
      placement="bottom-start"
    >
      <Icon style={css.raw({ color: 'gray.400' })} icon={IconAlertCircle} />
    </Tooltip>
  </svelte:fragment>

  <div>
    <div
      class={flex({
        align: 'center',
        justify: 'space-between',
        borderBottomWidth: '1px',
        borderColor: 'gray.200',
        paddingX: '24px',
        paddingY: '12px',
      })}
    >
      <div class={css({ display: 'flex' })}>
        <Checkbox
          style={css.raw({
            gap: '8px',
            fontSize: '14px',
            _after: {
              content: "''",
              display: 'block',
              marginLeft: '4px',
              backgroundColor: 'gray.200',
              height: '12px',
              width: '1px',
            },
          })}
          checked={allSelected}
          disabled={node.attrs.__data.length === 0}
          on:change={() => {
            // @ts-expect-error node.attrs.__data 타입이 any라서 map에서 타입 오류가 발생함
            selectedImages = allSelected ? [] : node.attrs.__data.map((i) => i.id);
          }}
        >
          전체선택
        </Checkbox>
        <button
          class={css({ paddingX: '12px', fontSize: '14px', color: '[#DC2626]' })}
          type="button"
          on:click={() => removeImages(selectedImages)}
        >
          삭제
        </button>
      </div>

      <div>
        <button
          class={css({ padding: '4px', borderRadius: '4px', _pressed: { backgroundColor: 'gray.200' } })}
          aria-pressed={view === 'grid'}
          type="button"
          on:click={() => (view = 'grid')}
        >
          <Icon style={css.raw({ color: 'gray.400' })} icon={IconLayoutGrid} size={20} />
        </button>

        <button
          class={css({ padding: '4px', borderRadius: '4px', _pressed: { backgroundColor: 'gray.200' } })}
          aria-pressed={view === 'list'}
          type="button"
          on:click={() => (view = 'list')}
        >
          <Icon style={css.raw({ color: 'gray.400' })} icon={IconList} size={20} />
        </button>
      </div>
    </div>

    <div
      bind:this={sortableGallery}
      class={css(
        {
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: '8px',
          paddingTop: '24px',
          paddingBottom: '32px',
          paddingX: '24px',
          height: '416px',
          overflowY: 'auto',
        },
        view === 'list' && { gap: '10px' },
      )}
    >
      {#each node.attrs.__data as image, index (image.id)}
        {#if view === 'grid'}
          <button
            class={cx(
              'image',
              flex({
                position: 'relative',
                flexDirection: 'column',
                flex: 'none',
                gap: '6px',
                borderRadius: '4px',
                padding: '6px',
                height: '127px',
                _hover: { backgroundColor: 'gray.100' },
                _pressed: { ringWidth: '[1.5px]', ringColor: 'teal.500', backgroundColor: 'teal.50' },
              }),
            )}
            aria-pressed={selectedImages.includes(image.id)}
            data-id={image.id}
            type="button"
            on:click={() => {
              selectedImages = selectedImages.includes(image.id)
                ? selectedImages.filter((id) => id !== image.id)
                : [...selectedImages, image.id];
            }}
          >
            <IsomorphicImage style={css.raw({ borderRadius: '5px', size: '92px', objectFit: 'cover' })} {image} />
            <p class={css({ fontSize: '12px', color: 'gray.400', textAlign: 'center', width: 'full' })}>{index + 1}</p>

            {#if index === 0}
              <div id={onboardingAnchorLastDynamicId} class={css({ position: 'absolute', inset: '0', zIndex: '-1' })} />
            {/if}
          </button>
        {:else}
          <button
            class={cx(
              'image',
              flex({
                position: 'relative',
                align: 'center',
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '4px',
                paddingX: '24px',
                paddingY: '10px',
                backgroundColor: { base: 'gray.5', _hover: 'gray.100' },
                height: '68px',
                width: 'full',
                _pressed: { ringWidth: '[1.5px]', ringColor: 'teal.500', backgroundColor: 'teal.50' },
              }),
            )}
            aria-pressed={selectedImages.includes(image.id)}
            data-id={image.id}
            type="button"
            on:click={() => {
              selectedImages = selectedImages.includes(image.id)
                ? selectedImages.filter((id) => id !== image.id)
                : [...selectedImages, image.id];
            }}
          >
            <span
              class={css({
                marginRight: '12px',
                fontSize: '14px',
                color: 'gray.400',
                textAlign: 'center',
                width: '26px',
              })}
            >
              {index + 1}
            </span>
            <IsomorphicImage
              style={css.raw({ marginRight: '16px', borderRadius: '6px', size: '48px', objectFit: 'cover' })}
              {image}
            />
            <p class={css({ flexGrow: '1', fontSize: '14px' })}>
              {image.kind === 'data' ? image.__data.name : image.__file.name}
            </p>

            <button class={css({ padding: '4px' })} type="button">
              <Icon style={css.raw({ color: 'gray.600' })} icon={IconGripVertical} size={24} />
            </button>
            {#if index === 0}
              <div id={onboardingAnchorLastDynamicId} class={css({ position: 'absolute', inset: '0', zIndex: '-1' })} />
            {/if}
          </button>
        {/if}
      {/each}
      {#if view === 'grid'}
        <button
          class={cx(
            'prevent-dragging',
            flex({
              flexDirection: 'column',
              gap: '6px',
              borderRadius: '4px',
              padding: '6px',
              height: '127px',
            }),
          )}
          type="button"
          on:click={handleInsertImage}
        >
          <div class={center({ borderRadius: '5px', backgroundColor: 'gray.100', size: '92px' })}>
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconPlus} size={20} />
          </div>

          <p class={css({ fontSize: '12px', color: 'gray.400', textAlign: 'center', width: 'full' })}>이미지 추가</p>
        </button>
      {:else}
        <button
          class={cx(
            'prevent-dragging',
            flex({
              align: 'center',
              borderWidth: '1px',
              borderColor: 'gray.200',
              borderRadius: '4px',
              paddingX: '20px',
              paddingY: '24px',
              color: 'gray.400',
              backgroundColor: 'gray.100',
              width: 'full',
              height: '68px',
            }),
          )}
          type="button"
          on:click={handleInsertImage}
        >
          <Icon style={css.raw({ marginRight: '4px' })} icon={IconPlus} size={20} />
          <span class={css({ fontSize: '14px', fontWeight: 'medium' })}>이미지 추가</span>
        </button>
      {/if}
    </div>
  </div>

  <svelte:fragment slot="action">
    {#if selectedImages.length > 0}
      <p class={css({ flexGrow: '1', fontSize: '14px' })}>
        이미지 {selectedImageName}
        {#if selectedImages.length > 1}
          외 <mark class={css({ color: 'teal.500' })}>{selectedImages.length - 1}개</mark>
        {/if}
        선택됨
      </p>
    {/if}

    <Button
      style={css.raw({ width: '95px' })}
      size="lg"
      variant="gray-outline"
      on:click={() => (imageListOpen = false)}
    >
      확인
    </Button>
  </svelte:fragment>
</Modal>
