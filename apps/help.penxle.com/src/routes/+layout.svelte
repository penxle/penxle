<script lang="ts">
  import '../app.css';

  import Logo from '$assets/branding/logo.svg?component';
  import { css } from '$styled-system/css';
  import { center, flex } from '$styled-system/patterns';
</script>

<div class={center({ flexDirection: 'column', minHeight: '100vh', fontFamily: 'PNXL_SUIT' })}>
  <header
    class={css({
      position: 'sticky',
      top: '0',
      paddingX: '32px',
      width: '100%',
      backgroundColor: 'gray.900',
      zIndex: '10',
    })}
  >
    <div class={flex({ align: 'center', marginX: 'auto', height: '64px', maxWidth: '1000px' })}>
      <a href="https://penxle.com">
        <Logo class={css({ height: '25px', color: 'gray.900' })} />
      </a>

      <div class={css({ borderLeftWidth: '1px', borderLeftColor: 'gray.5', marginX: '16px', height: '32px' })} />

      <a class={css({ fontSize: '18px', fontWeight: 'bold', color: 'gray.5', userSelect: 'none' })} href="/">
        도움 센터
      </a>
    </div>
  </header>

  <main class={css({ flexGrow: '1', paddingX: '32px', paddingY: '16px', width: '100%' })}>
    <div class={css({ marginX: 'auto', maxWidth: '1000px' })}>
      <slot />
    </div>
  </main>
</div>
