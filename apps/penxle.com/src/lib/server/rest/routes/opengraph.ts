import { GetObjectCommand } from '@aws-sdk/client-s3';
import { renderAsync } from '@resvg/resvg-js';
import { and, eq } from 'drizzle-orm';
import got from 'got';
import { png } from 'itty-router';
import satori from 'satori';
import sharp from 'sharp';
import twemoji from 'twemoji';
import { database, Images, PostRevisions, Posts, Profiles, SpaceMembers, Spaces } from '$lib/server/database';
import { s3 } from '$lib/server/external-api/aws';
import { createRouter } from '../router';
import type { IRequest } from 'itty-router';

export const opengraph = createRouter();

const DefaultCover = await got('https://glyph.pub/assets/opengraph/default-cover.png').buffer();
const PretendardLight = await got('https://glyph.pub/assets/fonts/Pretendard-Light.otf').buffer();
const PretendardRegular = await got('https://glyph.pub/assets/fonts/Pretendard-Regular.otf').buffer();
const PretendardSemibold = await got('https://glyph.pub/assets/fonts/Pretendard-SemiBold.otf').buffer();
const KoPubWorldDotumLight = await got('https://glyph.pub/assets/fonts/KoPubWorldDotumLight.otf').buffer();
const KoPubWorldDotumMedium = await got('https://glyph.pub/assets/fonts/KoPubWorldDotumMedium.otf').buffer();
const KoPubWorldDotumBold = await got('https://glyph.pub/assets/fonts/KoPubWorldDotumBold.otf').buffer();

opengraph.get('/opengraph/post/:postId', async (request) => {
  const postId = (request as IRequest).params.postId;

  // const post = await db.post.findUnique({
  //   select: {
  //     publishedRevision: { select: { title: true, subtitle: true } },
  //     space: { select: { name: true } },
  //     member: { select: { profile: { select: { name: true } } } },
  //     thumbnail: { select: { path: true } },
  //   },
  //   where: {
  //     id: postId,
  //     state: 'PUBLISHED',
  //   },
  // });

  const posts = await database
    .select({
      publishedRevision: { title: PostRevisions.title, subtitle: PostRevisions.subtitle },
      space: { name: Spaces.name },
      member: { name: Profiles.name },
      thumbnail: { path: Images.path },
    })
    .from(Posts)
    .innerJoin(PostRevisions, eq(PostRevisions.id, Posts.publishedRevisionId))
    .innerJoin(Spaces, eq(Spaces.id, Posts.spaceId))
    .innerJoin(SpaceMembers, eq(SpaceMembers.id, Posts.memberId))
    .innerJoin(Profiles, eq(Profiles.id, SpaceMembers.profileId))
    .leftJoin(Images, eq(Images.id, Posts.thumbnailId))
    .where(and(eq(Posts.id, postId), eq(Posts.state, 'PUBLISHED')));

  if (posts.length === 0) {
    return png(DefaultCover);
  }

  const [post] = posts;

  const svg = await satori(
    {
      type: 'div',
      props: {
        children: [
          {
            type: 'div',
            props: {
              children: [
                {
                  type: 'img',
                  props: {
                    // spell-checker:disable-next-line
                    src: 'data:image/svg+xml,%3Csvg width="125" height="23" viewBox="0 0 125 23" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cg opacity="0.4"%3E%3Cpath fill-rule="evenodd" clip-rule="evenodd" d="M3.53957 0.881287C1.58472 0.881287 0 2.466 0 4.42085V18.5791C0 20.534 1.58472 22.1187 3.53956 22.1187H17.6978C19.6527 22.1187 21.2374 20.534 21.2374 18.5791V4.42086C21.2374 2.46601 19.6527 0.881287 17.6978 0.881287H3.53957ZM6.52608 14.6296C6.98568 13.4156 8.67526 8.95299 6.61461 4.42086C6.61461 4.42086 10.3719 9.07574 15.8947 9.67596C15.8947 9.67596 14.0752 14.5657 15.3284 18.7727L12.1595 13.284C12.425 12.9735 12.4803 12.5174 12.2644 12.1434C11.9906 11.6691 11.3841 11.5066 10.9097 11.7805C10.4354 12.0543 10.2729 12.6608 10.5468 13.1351C10.7794 13.538 11.2521 13.716 11.6798 13.5925L13.4952 16.626L14.9122 19.0802C13.5573 17.6939 10.7391 15.4444 6.42315 14.9514C6.40481 14.9499 6.44744 14.8373 6.52607 14.6296L6.52608 14.6296Z" fill="white"/%3E%3Cpath d="M27.7822 20.7915V2.2088H33.9468C38.4742 2.2088 41.3391 4.58739 41.3391 8.32871C41.3391 11.5993 38.8579 14.7212 33.9468 14.7212H32.0283V20.7915H27.7822ZM31.9516 11.302H33.9212C35.8908 11.302 37.093 10.1127 37.093 8.35349C37.093 6.79254 35.9419 5.62802 33.9212 5.62802H31.9516V11.302Z" fill="white"/%3E%3Cpath d="M44.2187 20.7915V2.2088H56.2664V5.70236H48.4648V9.64189H55.3711V12.8629H48.4648V17.298H56.2664V20.7915H44.2187Z" fill="white"/%3E%3Cpath d="M59.631 20.7915V2.2088H63.6213L71.781 14.0274V2.2088H75.7713V20.7915H71.781L63.6213 9.17113V20.7915H59.631Z" fill="white"/%3E%3Cpath d="M78.5574 20.7915V18.9333L84.1848 11.3763L78.8388 4.14141V2.2088H82.5733L86.9985 8.40305L91.1423 2.2088H94.4931V4.06708L89.2495 11.2524L94.8512 18.8589V20.7915H91.1167L86.4869 14.2504L81.9083 20.7915H78.5574Z" fill="white"/%3E%3Cpath d="M97.6248 20.7915V2.2088H101.871V17.298H109.545V20.7915H97.6248Z" fill="white"/%3E%3Cpath d="M112.188 20.7915V2.2088H124.235V5.70236H116.434V9.64189H123.34V12.8629H116.434V17.298H124.235V20.7915H112.188Z" fill="white"/%3E%3C/g%3E%3C/svg%3E%0A',
                    width: 125,
                    height: 23,
                  },
                },
                {
                  type: 'div',
                  props: {
                    children: post.publishedRevision.title ?? '(제목 없음)',
                    style: {
                      marginTop: '60px',
                      display: 'block',
                      fontSize: '60px',
                      fontWeight: 600,
                      lineHeight: '1.2',
                      letterSpacing: '0.01em',
                      wordBreak: 'break-all',
                      lineClamp: 2,
                    },
                  },
                },
                ...(post.publishedRevision.subtitle
                  ? [
                      {
                        type: 'div',
                        props: {
                          children: post.publishedRevision.subtitle,
                          style: {
                            marginTop: '8px',
                            display: 'block',
                            fontSize: '32px',
                            fontWeight: 400,
                            lineHeight: '1.2',
                            letterSpacing: '0.01em',
                            opacity: 0.8,
                            wordBreak: 'break-all',
                            lineClamp: 1,
                          },
                        },
                      },
                    ]
                  : []),
                {
                  type: 'div',
                  props: {
                    style: {
                      flexGrow: 1,
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    children: post.space.name,
                    style: {
                      display: 'block',
                      fontSize: '28px',
                      fontWeight: 300,
                      lineHeight: '1.2',
                      letterSpacing: '0.01em',
                      opacity: 0.8,
                      wordBreak: 'break-all',
                      lineClamp: 1,
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    children: `by ${post.member.name}`,
                    style: {
                      marginTop: '3px',
                      display: 'block',
                      fontSize: '27px',
                      fontWeight: 300,
                      lineHeight: '1.2',
                      letterSpacing: '0.01em',
                      opacity: 0.7,
                      wordBreak: 'break-all',
                      lineClamp: 1,
                    },
                  },
                },
              ],
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: post.thumbnail ? '620px' : '100%',
                height: '100%',
              },
            },
          },
          ...(post.thumbnail
            ? [
                {
                  type: 'img',
                  props: {
                    src: await getS3ImageSrc(post.thumbnail.path),
                    width: 420,
                    height: 630,
                    style: {
                      position: 'absolute',
                      right: 0,
                      objectFit: 'cover',
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      position: 'absolute',
                      right: 0,
                      width: '420px',
                      height: '630px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    },
                  },
                },
              ]
            : []),
        ],
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '80px',
          color: '#ffffff',
          backgroundColor: '#18181B',
          fontFamily: 'Pretendard, KoPubWorldDotum',
        },
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Pretendard', data: PretendardLight, weight: 300, style: 'normal' },
        { name: 'Pretendard', data: PretendardRegular, weight: 400, style: 'normal' },
        { name: 'Pretendard', data: PretendardSemibold, weight: 600, style: 'normal' },
        { name: 'KoPubWorldDotum', data: KoPubWorldDotumLight, weight: 300, style: 'normal' },
        { name: 'KoPubWorldDotum', data: KoPubWorldDotumMedium, weight: 400, style: 'normal' },
        { name: 'KoPubWorldDotum', data: KoPubWorldDotumBold, weight: 600, style: 'normal' },
      ],
      loadAdditionalAsset: async (code, segment) => {
        if (code === 'emoji') {
          const codepoint = twemoji.convert.toCodePoint(segment);
          const svg = await got(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoint}.svg`).text();
          return 'data:image/svg+xml,' + encodeURIComponent(svg);
        }

        return (
          'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
        );
      },
    },
  );

  const img = await renderAsync(svg, {
    font: { loadSystemFonts: false },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });

  return png(img.asPng());
});

const getS3ImageSrc = async (key: string) => {
  const object = await s3.send(new GetObjectCommand({ Bucket: 'penxle-data', Key: key }));
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const source = await object.Body!.transformToByteArray();
  const buffer = await sharp(source, { failOn: 'none' }).png().toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
};
