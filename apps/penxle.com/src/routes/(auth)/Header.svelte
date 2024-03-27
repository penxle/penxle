<script lang="ts">
  import Logo from '$assets/branding/logo.svg?component';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
</script>

<header
  class={flex({
    align: 'center',
    paddingX: { base: '16px', sm: '30px' },
    paddingY: '8px',
    width: 'full',
    height: '60px',
    zIndex: '10',
  })}
>
  <a href="/">
    <Logo class={css({ color: 'gray.5', height: '25px', hideBelow: 'sm' })} />
  </a>
</header>
