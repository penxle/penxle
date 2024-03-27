<script lang="ts">
  import LogoFloating from '$assets/branding/logo-floating.svg?component';
  import { Helmet, Link } from '$lib/components';
  import { css } from '$styled-system/css';
  import { center } from '$styled-system/patterns';
</script>

<Helmet description="펜슬은 지금 점검중이에요" title="점검중" />

<div class={center({ flexDirection: 'column', flexGrow: '1', gap: '16px', marginX: 'auto', textAlign: 'center' })}>
  <LogoFloating class={css({ size: '100px' })} />

  <h2 class={css({ fontSize: '24px', fontWeight: 'semibold' })}>펜슬은 지금 점검중이에요.</h2>

  <p class={css({ fontSize: '14px', color: 'gray.600' })}>
    서비스 점검이 진행중이에요.
    <br />
    잠시 후 다시 시도해주세요!
  </p>

  <Link style={css.raw({ fontSize: '14px' })} colored href="https://twitter.com/pencil_site" underline>
    @pencil_site
  </Link>
</div>
