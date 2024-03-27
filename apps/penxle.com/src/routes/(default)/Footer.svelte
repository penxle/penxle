<script lang="ts">
  import IconEffit from '~icons/effit/effit';
  import IconGithub from '~icons/simple-icons/github';
  import IconInstagram from '~icons/simple-icons/instagram';
  import IconTwitter from '~icons/simple-icons/twitter';
  import Logo from '$assets/branding/logo.svg?component';
  import { Icon, Link } from '$lib/components';
  import { css } from '$styled-system/css';
  import { flex } from '$styled-system/patterns';
</script>

<footer
  class={css({
    borderTopWidth: '1px',
    paddingX: { base: '16px', sm: '30px' },
    paddingY: '40px',
    color: 'gray.500',
    fontSize: '12px',
    letterSpacing: '[0.05em]',
  })}
>
  <div
    class={flex({
      justify: 'space-between',
      gap: '24px',
      wrap: 'wrap',
      marginX: 'auto',
      width: 'full',
      maxWidth: '1200px',
    })}
  >
    <div>
      <section class={flex({ justify: 'space-between', align: 'center', marginBottom: '16px' })}>
        <Logo class={css({ height: '22px', color: 'gray.900' })} />
      </section>

      <section class={flex({ direction: 'column', gap: '4px' })}>
        <div class={flex({ align: 'center', wrap: 'wrap' })}>
          <div>(주)펜슬컴퍼니</div>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <div>대표: 배준현</div>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <div>개인정보관리책임자: 배준현</div>
        </div>

        <div class={flex({ align: 'center', wrap: 'wrap' })}>
          <div>사업자등록번호: 610-88-03078</div>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <Link href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6108803078">통신판매업신고: 2023-서울강남-4541</Link>
        </div>

        <div class={flex({ align: 'center', wrap: 'wrap' })}>
          <div>주소: 서울특별시 강남구 강남대로100길 14, 6층</div>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <div>전화: 02-565-7695</div>
        </div>
      </section>

      <section class={flex({ align: 'center', wrap: 'wrap', marginTop: '16px' })}>
        <Link href="https://help.penxle.com/legal/terms">이용약관</Link>
        <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
        <Link style={css.raw({ fontWeight: 'medium' })} href="https://help.penxle.com/legal/privacy">
          개인정보처리방침
        </Link>
        <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
        <div class={flex({ align: 'center', wrap: 'wrap' })}>
          <Link href="https://penxle.channel.io">고객 센터</Link>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <Link href="/pencil">펜슬 소식</Link>
          <div class={css({ height: '8px', borderLeftWidth: '1px', borderLeftColor: 'gray.600', marginX: '4px' })} />
          <Link href="https://penxle.io">펜슬컴퍼니 소개</Link>
        </div>
      </section>
    </div>

    <div>
      <div class={flex({ align: 'center', gap: '16px' })}>
        <Link href="/pencil">
          <Icon style={css.raw({ color: { _hover: 'gray.900' } })} icon={IconEffit} />
        </Link>

        <Link href="https://twitter.com/pencil_site">
          <Icon style={css.raw({ color: { _hover: '[#1DA1F2]' } })} icon={IconTwitter} />
        </Link>

        <Link href="https://www.instagram.com/penxle.team/">
          <Icon style={css.raw({ color: { _hover: '[#E4405F]' } })} icon={IconInstagram} />
        </Link>

        <Link href="https://github.com/penxle">
          <Icon style={css.raw({ color: { _hover: '[#181717]' } })} icon={IconGithub} />
        </Link>
      </div>
    </div>
  </div>
</footer>
