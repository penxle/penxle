<script lang="ts">
  import IconDeviceDesktop from '~icons/tabler/device-desktop';
  import IconDeviceMobile from '~icons/tabler/device-mobile';
  import { page } from '$app/stores';
  import Logo from '$assets/branding/logo.svg?component';
  import { graphql } from '$glitch';
  import { Helmet, Icon } from '$lib/components';
  import { css } from '$styled-system/css';
  import { center, flex, grid } from '$styled-system/patterns';
  import Post from '../../../(default)/[space]/Post.svelte';
  import Footer from '../../../(default)/Footer.svelte';

  let mode: 'desktop' | 'mobile' = 'desktop';

  $: hideHeader = $page.url.searchParams.get('hideHeader') === 'true';

  $: query = graphql(`
    query EditorPermalinkPreviewPage_Query($permalink: String!, $revisionId: ID) {
      post(permalink: $permalink) {
        id

        draftRevision(revisionId: $revisionId) @_required {
          id
          title
          ...Post_postRevision
        }
      }

      ...Post_query
    }
  `);
</script>

<Helmet description="포스트 미리보기" title={`${$query.post.draftRevision.title ?? '(제목 없음)'} 미리보기`} />

{#if !hideHeader}
  <header
    class={center({
      position: 'sticky',
      top: '0',
      borderBottomWidth: '1px',
      borderBottomColor: 'gray.200',
      paddingX: { base: '16px', sm: '30px' },
      paddingY: '8px',
      height: '61px',
      backgroundColor: 'gray.5',
      zIndex: '10',
    })}
  >
    <nav class={css({ width: 'full', maxWidth: '1200px' })}>
      <section class={flex({ position: 'relative', justify: 'space-between', align: 'center' })}>
        <div
          class={flex({
            position: 'absolute',
            left: '0',
            align: 'center',
            gap: '8px',
            marginRight: { base: '14px', sm: '16px' },
            width: 'full',
            transition: 'common',
          })}
        >
          <Logo class={css({ height: '25px', color: 'gray.900' })} />
        </div>
        <div class={center({ flexGrow: '1' })}>
          <div
            class={grid({
              position: 'relative',
              columns: 2,
              borderRadius: '10px',
              width: 'fit',
              height: '40px',
              backgroundColor: 'gray.100',
              _before: {
                content: '""',
                position: 'absolute',
                left: mode === 'mobile' ? '1/2' : '0',
                borderWidth: '1px',
                borderColor: 'gray.200',
                borderRadius: '10px',
                width: '1/2',
                height: 'full',
                backgroundColor: 'gray.5',
                transition: 'all',
              },
            })}
          >
            <button
              class={flex({
                align: 'center',
                gap: '8px',
                paddingX: '16px',
                paddingY: '8px',
                height: '40px',
                zIndex: '1',
                _first: {
                  color: mode === 'desktop' ? 'gray.900' : 'gray.400',
                  transition: 'colors',
                },
                _last: {
                  color: mode === 'mobile' ? 'gray.900' : 'gray.400',
                  transition: 'colors',
                },
              })}
              type="button"
              on:click={() => {
                mode = 'desktop';
              }}
            >
              <Icon icon={IconDeviceDesktop} size={20} />
            </button>
            <button
              class={flex({
                align: 'center',
                gap: '8px',
                paddingX: '16px',
                paddingY: '8px',
                height: '40px',
                zIndex: '1',
                _first: {
                  color: mode === 'desktop' ? 'gray.900' : 'gray.400',
                  transition: 'colors',
                },
                _last: {
                  color: mode === 'mobile' ? 'gray.900' : 'gray.400',
                  transition: 'colors',
                },
              })}
              type="button"
              on:click={() => {
                mode = 'mobile';
              }}
            >
              <Icon icon={IconDeviceMobile} size={20} />
            </button>
          </div>
        </div>
      </section>
    </nav>
  </header>
{/if}

<main
  class={flex({
    justify: 'center',
    align: 'flex-start',
    grow: '1',
    margin: 'auto',
    width: 'full',
    backgroundColor: 'gray.50',
  })}
>
  <Post
    style={css.raw(
      mode === 'desktop'
        ? { borderXWidth: '1px', borderXColor: 'gray.200', paddingY: '30px', maxWidth: '1048px' }
        : { paddingY: '68px', maxWidth: '400px' },
    )}
    $postRevision={$query.post.draftRevision}
    {$query}
  />
</main>

<Footer />
