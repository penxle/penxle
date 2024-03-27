<script lang="ts">
  import { validator } from '@felte/validator-zod';
  import dayjs from 'dayjs';
  import { createForm } from 'felte';
  import { tick } from 'svelte';
  import { z } from 'zod';
  import IconAlertTriangle from '~icons/tabler/alert-triangle';
  import IconFolder from '~icons/tabler/folder';
  import IconGripVertical from '~icons/tabler/grip-vertical';
  import IconPhoto from '~icons/tabler/photo';
  import IconTextRecognition from '~icons/tabler/text-recognition';
  import { afterNavigate } from '$app/navigation';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { Icon, Tooltip } from '$lib/components';
  import { Button, Modal } from '$lib/components/v2';
  import { createFloatingActions, portal } from '$lib/svelte/actions';
  import { NodeView } from '$lib/tiptap';
  import { comma } from '$lib/utils';
  import { css, cx } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
  import LoginRequireModal from '../../../../routes/(default)/LoginRequireModal.svelte';
  import { priceErrorMap } from './zod';
  import type { NodeViewProps } from '$lib/tiptap';

  type $$Props = NodeViewProps;
  $$restProps;

  export let node: NodeViewProps['node'];
  export let getPos: NodeViewProps['getPos'];
  export let selected: NodeViewProps['selected'];
  export let editor: NodeViewProps['editor'] | undefined;
  export let updateAttributes: NodeViewProps['updateAttributes'];

  $: isLastChild = editor?.state.doc.lastChild?.eq(node) ?? false;

  let priceOpen = false;
  let loginRequireOpen = false;
  let postPurchaseOpen = false;

  let priceInputEl: HTMLInputElement | undefined;

  const purchasePost = graphql(`
    mutation TiptapAccessBarrier_PurchasePost_Mutation($input: PurchasePostInput!) {
      purchasePost(input: $input) {
        id

        publishedRevision {
          id
          content
        }
      }
    }
  `);

  const { anchor, floating } = createFloatingActions({
    placement: 'bottom',
    offset: 8,
  });

  const { form, isSubmitting, setInitialValues, errors } = createForm({
    extend: [
      validator({
        schema: z.object({
          price: z
            .string()
            .transform((value) => Number.parseInt(value.replaceAll(',', '')))
            .pipe(z.number({ errorMap: priceErrorMap }).int().min(100).max(1_000_000).multipleOf(100)),
        }),
      }),
    ],
    onSubmit: ({ price }: { price: string }) => {
      const parsed = Number.parseInt(price.replaceAll(',', ''));
      if (Number.isNaN(parsed)) throw new Error('Unexpected invalid price');

      updateAttributes({ price: parsed });
    },
  });

  let isSubmitted = false;
  $: if ($isSubmitting && !isSubmitted) {
    isSubmitted = true;
  }

  $: invalidPrice = isSubmitted && !!$errors.price;
  $: priceErrorDetailTooltipId = invalidPrice ? 'price-error' : undefined;

  $: setInitialValues({ price: node.attrs.price ? comma(node.attrs.price) : '' });

  $: if (priceOpen) {
    // eslint-disable-next-line unicorn/prefer-top-level-await
    tick().then(() => {
      priceInputEl?.focus();
    });
  } else {
    isSubmitted = false;
  }

  afterNavigate(() => {
    priceOpen = false;
  });
</script>

{#if editor?.isEditable}
  <NodeView
    style={css.raw(
      {
        position: 'relative',
        display: 'flex',
        justifyContent: 'flex-end',
        borderRadius: '6px',
        paddingY: '16px',
      },
      selected && { outlineWidth: '2px', outlineColor: 'teal.500' },
    )}
    data-drag-handle
    draggable
  >
    <div class={center({ position: 'absolute', inset: '0' })}>
      <div class={cx('line', css({ width: 'full', height: '[1.5px]', color: 'gray.300' }))}></div>
    </div>

    <div
      class={center({
        position: 'relative',
        gap: '8px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '6px',
        padding: '8px',
        marginRight: '20px',
        width: 'fit',
        color: 'gray.600',
        backgroundColor: 'gray.5',
        boxShadow: '[0 2px 10px 0 {colors.gray.900/4}]',
      })}
    >
      {#if isLastChild}
        <button
          class={css({
            borderRadius: '4px',
            paddingX: '6px',
            paddingY: '4px',
            fontSize: { base: '12px', sm: '14px' },
            fontWeight: 'medium',
            transition: 'common',
            _hover: { backgroundColor: 'gray.100' },
          })}
          type="button"
          on:click={() =>
            editor
              ?.chain()
              .insertContentAt(getPos() + node.nodeSize, { type: 'paragraph' })
              .focus()
              .run()}
        >
          여기서부터 유료 분량 만들기
        </button>
      {:else}
        <div
          class={css({
            paddingX: '6px',
            paddingY: '4px',
            fontSize: { base: '12px', sm: '14px' },
            fontWeight: 'medium',
            whiteSpace: 'nowrap',
          })}
        >
          여기서부터 유료 분량
        </div>

        <div class={css({ width: '1px', height: '14px', backgroundColor: 'gray.200' })} />

        <button
          class={center({
            gap: '4px',
            borderRadius: '4px',
            paddingX: '6px',
            paddingY: '4px',
            fontSize: { base: '12px', sm: '14px' },
            fontWeight: 'medium',
            color: node.attrs.price ? 'teal.600' : 'red.600',
            backgroundColor: { _hover: 'gray.100', _pressed: 'gray.100' },
            transition: 'common',
            whiteSpace: 'nowrap',
          })}
          aria-pressed={priceOpen}
          type="button"
          on:click={() => (priceOpen = true)}
          use:anchor
        >
          {#if node.attrs.price}
            {comma(node.attrs.price)} P
          {:else}
            <Icon icon={IconAlertTriangle} />
            가격설정
          {/if}
        </button>

        <div class={css({ width: '1px', height: '14px', backgroundColor: 'gray.200' })} />

        <button
          class={css({
            borderRadius: '4px',
            paddingX: '6px',
            paddingY: '4px',
            fontSize: { base: '12px', sm: '14px' },
            fontWeight: 'medium',
            whiteSpace: 'nowrap',
            transition: 'common',
            _hover: { backgroundColor: 'gray.100' },
          })}
          type="button"
          on:click={() => {
            updateAttributes({ price: null });
            // Hack: "RangeError: Index out of range" 가 일어나서 setTimeout 을 통해 이벤트 루프를 분리하니 해결됨
            setTimeout(() =>
              editor
                ?.chain()
                .cut({ from: getPos(), to: getPos() + node.nodeSize }, editor.state.doc.content.size)
                .run(),
            );
          }}
        >
          해제
        </button>
      {/if}

      <div class={css({ width: '1px', height: '14px', backgroundColor: 'gray.200' })} />

      <div
        class={css({
          flex: 'none',
          borderRadius: '4px',
          padding: '4px',
          transition: 'common',
          _hover: { backgroundColor: 'gray.100' },
        })}
      >
        <Icon icon={IconGripVertical} size={20} />
      </div>
    </div>

    {#if priceOpen}
      <div
        class={css({ position: 'fixed', inset: '0', zIndex: '40' })}
        role="button"
        tabindex="-1"
        on:click={() => (priceOpen = false)}
        on:keypress={null}
        use:portal
      />

      <div
        class={flex({
          direction: 'column',
          gap: '6px',
          borderWidth: '1px',
          borderColor: 'gray.200',
          borderBottomRadius: '6px',
          paddingX: '10px',
          paddingTop: '8px',
          paddingBottom: '10px',
          backgroundColor: 'gray.5',
          zIndex: '50',
        })}
        use:floating
      >
        <form class={css({ display: 'contents' })} use:form>
          <Tooltip enabled={invalidPrice} keepShowing offset={8} placement="top">
            <span id={priceErrorDetailTooltipId} slot="message" aria-live="assertive">
              {#if $errors.price}
                {@html $errors.price.join('<br />')}
              {/if}
            </span>
            <div class={css({ position: 'relative' })}>
              <input
                bind:this={priceInputEl}
                name="price"
                class={css({
                  borderWidth: '1px',
                  borderColor: 'gray.200',
                  borderRadius: '4px',
                  paddingLeft: '12px',
                  paddingRight: '24px',
                  paddingY: '10px',
                  width: '110px',
                  backgroundColor: 'gray.5',
                  _invalid: {
                    borderColor: 'red.600',
                    backgroundColor: 'red.50',
                  },
                })}
                aria-errormessage={priceErrorDetailTooltipId}
                aria-invalid={invalidPrice}
                inputmode="numeric"
                placeholder="1,000"
                on:input={(event) => {
                  const parsed = Number.parseInt(event.currentTarget.value.replaceAll(/\D/g, ''));

                  event.currentTarget.value = Number.isNaN(parsed) ? '' : comma(parsed);
                }}
              />
              <span class={center({ position: 'absolute', right: '0', insetY: '0', paddingRight: '12px' })}>P</span>
            </div>
          </Tooltip>

          <Button size="sm" type="submit" variant="cyan-fill">설정</Button>
        </form>
      </div>
    {/if}
  </NodeView>
{:else if node.attrs.__data.purchasable}
  <NodeView style={center.raw({ paddingY: '16px' })}>
    <div
      class={flex({
        direction: 'column',
        gap: '10px',
        borderWidth: '1px',
        borderColor: 'gray.150',
        borderRadius: '6px',
        paddingX: '24px',
        paddingY: '20px',
        width: 'full',
        maxWidth: '500px',
        pointerEvents: 'auto',
      })}
    >
      <div class={css({ fontSize: '14px', color: 'gray.500' })}>
        다음 내용을 감상해보시겠어요?
        <br />
        구매한 포스트는 영구 소장이 가능해요
      </div>

      <div>
        <div class={flex({ align: 'center' })}>
          <span class={css({ flexGrow: '1', fontSize: '20px', fontWeight: 'semibold' })}>
            {comma(node.attrs.price)}P
          </span>
          <Button
            style={css.raw({ hideBelow: 'sm' })}
            size="md"
            on:click={() => {
              if (node.attrs.__data.point === null) {
                loginRequireOpen = true;
                return;
              }

              postPurchaseOpen = true;
            }}
          >
            구매하기
          </Button>
          <Button
            style={css.raw({ hideFrom: 'sm' })}
            size="sm"
            on:click={() => {
              if (node.attrs.__data.point === null) {
                loginRequireOpen = true;
                return;
              }

              postPurchaseOpen = true;
            }}
          >
            구매하기
          </Button>
        </div>

        <div
          class={css({
            marginTop: '12px',
            marginBottom: '8px',
            width: 'full',
            height: '1px',
            backgroundColor: 'gray.100',
          })}
        />

        <div class={flex({ align: 'center', gap: '8px' })}>
          <div class={flex({ align: 'center', gap: '4px' })}>
            <Icon style={css.raw({ color: 'gray.400' })} icon={IconTextRecognition} />
            <span class={css({ fontSize: '14px', color: 'gray.500' })}>
              {comma(node.attrs.__data.counts.characters)}자
            </span>
          </div>

          {#if node.attrs.__data.counts.images}
            <div class={flex({ align: 'center', gap: '4px' })}>
              <Icon style={css.raw({ color: 'gray.400' })} icon={IconPhoto} />
              <span class={css({ fontSize: '14px', color: 'gray.500' })}>
                {comma(node.attrs.__data.counts.images)}개
              </span>
            </div>
          {/if}

          {#if node.attrs.__data.counts.files}
            <div class={flex({ align: 'center', gap: '4px' })}>
              <Icon style={css.raw({ color: 'gray.400' })} icon={IconFolder} />
              <span class={css({ fontSize: '14px', color: 'gray.500' })}>
                {comma(node.attrs.__data.counts.files)}개
              </span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </NodeView>

  <Modal bind:open={postPurchaseOpen}>
    <svelte:fragment slot="title">
      {node.attrs.__data.point < node.attrs.price ? '포인트 충전' : '포스트 구매'}
    </svelte:fragment>

    <div
      class={flex({
        justify: 'space-between',
        align: 'center',
        borderRadius: '4px',
        marginBottom: '8px',
        paddingX: '14px',
        paddingY: '12px',
        backgroundColor: 'gray.50',
      })}
    >
      <p class={css({ fontSize: '14px', color: 'gray.500' })}>현재 보유한 포인트</p>

      <p class={css({ borderRadius: '4px', paddingX: '8px', paddingY: '6px', width: '117px', color: 'gray.400' })}>
        <span class={css({ fontWeight: 'semibold', color: 'gray.500' })}>{comma(node.attrs.__data.point)}</span>
        P
      </p>
    </div>

    <div
      class={flex({
        justify: 'space-between',
        align: 'center',
        borderRadius: '4px',
        marginBottom: '6px',
        paddingX: '14px',
        paddingY: '12px',
        backgroundColor: 'gray.50',
      })}
    >
      <p class={css({ fontSize: '14px', color: 'gray.500' })}>사용할 포인트</p>

      <p
        class={css({
          outlineWidth: '1px',
          outlineColor: 'gray.300',
          borderRadius: '4px',
          paddingX: '8px',
          paddingY: '6px',
          width: '117px',
          color: 'gray.400',
          backgroundColor: 'gray.100',
        })}
      >
        <span class={css({ fontWeight: 'semibold', color: 'gray.500' })}>
          {comma(node.attrs.price)}
        </span>
        P
      </p>
    </div>

    <p class={css({ marginBottom: '32px', textAlign: 'right', fontSize: '13px', color: 'gray.400' })}>
      {#if node.attrs.__data.point < node.attrs.price}
        필요한 포인트
        <mark class={css({ fontSize: '13px', fontWeight: 'medium', color: 'red.600' })}>
          {comma(node.attrs.__data.point - node.attrs.price)}P
        </mark>
      {/if}
    </p>

    <svelte:fragment slot="action">
      {#if node.attrs.__data.point < node.attrs.price}
        <Button style={css.raw({ width: 'full' })} href="/point/purchase" size="lg" type="link">충전하기</Button>
      {:else}
        <Button
          style={css.raw({ width: 'full' })}
          size="lg"
          on:click={async () => {
            await purchasePost({
              postId: node.attrs.__data.postId,
              revisionId: node.attrs.__data.revisionId,
            });

            mixpanel.track('post:purchase', {
              postId: node.attrs.__data.postId,
              kind: 'article',
              price: node.attrs.price,
            });

            postPurchaseOpen = false;
          }}
        >
          구매하기
        </Button>
      {/if}
    </svelte:fragment>
  </Modal>

  <LoginRequireModal bind:open={loginRequireOpen} />
{:else}
  <NodeView
    style={css.raw(
      {
        position: 'relative',
        display: 'flex',
        justifyContent: 'flex-end',
        borderRadius: '6px',
        paddingY: '16px',
        pointerEvents: 'auto',
      },
      selected && {
        outlineWidth: '2px',
        outlineColor: 'teal.500',
      },
    )}
    data-drag-handle
    draggable
  >
    <div class={center({ position: 'absolute', inset: '0' })}>
      <div
        class={cx(
          'line',
          css({
            width: 'full',
            height: '[1.5px]',
            color: 'gray.300',
          }),
        )}
      ></div>
    </div>

    <div
      class={center({
        position: 'relative',
        gap: '8px',
        borderWidth: '1px',
        borderColor: 'gray.200',
        borderRadius: '6px',
        marginRight: '20px',
        padding: '8px',
        width: 'fit',
        color: 'gray.600',
        backgroundColor: 'gray.5',
        boxShadow: '[0 2px 10px 0 {colors.gray.900/4}]',
      })}
    >
      <div class={css({ paddingX: '6px', paddingY: '4px', fontSize: '14px', fontWeight: 'medium' })}>
        이 지점부터 유료 분량이 시작됩니다
      </div>

      <div class={css({ width: '1px', height: '14px', backgroundColor: 'gray.200' })} />

      <div
        class={center({ paddingX: '6px', paddingY: '4px', fontSize: '14px', fontWeight: 'medium', color: 'teal.600' })}
      >
        {comma(node.attrs.price)}P
      </div>

      {#if node.attrs.__data.purchasedAt}
        <div
          class={css({
            position: 'absolute',
            top: '0',
            right: '0',
            paddingBottom: '4px',
            fontSize: '13px',
            color: 'gray.400',
            translate: 'auto',
            translateY: '-full',
          })}
        >
          {dayjs(node.attrs.__data.purchasedAt).formatAsDate()} (결제 완료)
        </div>
      {/if}
    </div>
  </NodeView>
{/if}

<style>
  .line {
    background: repeating-linear-gradient(to right, transparent 0 4px, currentColor 4px 8px);
  }
</style>
