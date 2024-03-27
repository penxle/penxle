<script lang="ts">
  import '../app.css';

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { graphql } from '$glitch';
  import { mixpanel } from '$lib/analytics';
  import { toast, ToastProvider } from '$lib/notification';
  import { flex } from '$styled-system/patterns';
  import AutoUpdater from './AutoUpdater.svelte';
  import StackIndicator from './StackIndicator.svelte';

  $: query = graphql(`
    query RootLayout_Query {
      me {
        id
        email

        profile {
          id
          name

          avatar {
            id
            url
          }
        }
      }

      flash {
        type
        message
      }
    }
  `);

  $: if (browser && $query.me) {
    mixpanel.identify($query.me.id);
    mixpanel.people.set({
      $email: $query.me.email,
      $name: $query.me.profile.name,
      $avatar: $query.me.profile.avatar.url,
    });
  }

  onMount(() => {
    if ($query.flash) {
      toast($query.flash.message);
    }
  });
</script>

<svelte:head>
  <script data-domain="pencil.so" defer src="https://plausible.io/js/script.js"></script>
</svelte:head>

<div class={flex({ direction: 'column', position: 'relative', minHeight: 'dvh' })}>
  <slot />
</div>

<AutoUpdater />
<StackIndicator />
<ToastProvider />
