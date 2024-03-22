import { PutObjectCommand } from '@aws-sdk/client-s3';
import { renderAsync } from '@resvg/resvg-js';
import got from 'got';
import satori from 'satori';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import twemoji from 'twemoji';
import { aws } from '$lib/server/external-api';
import { database, Images } from '../database';
import { getDominantColor } from './mmcq';
import type { ImageBounds } from '$lib/utils';

type ImageSource = Buffer | ArrayBuffer | Uint8Array;

const PretendardLight = await got('https://glyph.pub/assets/fonts/Pretendard-Light.otf').buffer();
const PretendardRegular = await got('https://glyph.pub/assets/fonts/Pretendard-Regular.otf').buffer();
const RIDIBatang = await got('https://glyph.pub/assets/fonts/RIDIBatang.otf').buffer();

export const finalizeImage = async (source: ImageSource, bounds?: ImageBounds) => {
  let image = sharp(source, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' });

  if (bounds) {
    image = image.extract(bounds);
  }

  const getOutput = async () => {
    return await image.clone().toBuffer({ resolveWithObject: true });
  };

  const getColor = async () => {
    const buffer = await image.clone().raw().toBuffer();
    return getDominantColor(buffer);
  };

  const getPlaceholder = async () => {
    const {
      data: raw,
      info: { width, height },
    } = await image
      .clone()
      .resize({
        width: 100,
        height: 100,
        fit: 'inside',
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = rgbaToThumbHash(width, height, raw);
    return Buffer.from(hash).toString('base64');
  };

  const getHash = async () => {
    const size = 16;

    const raw = await image
      .clone()
      .greyscale()
      .resize({
        width: size + 1,
        height: size,
        fit: 'fill',
      })
      .raw()
      .toBuffer();

    let difference = '';
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const left = raw[row * (size + 1) + col];
        const right = raw[row * (size + 1) + col + 1];
        difference += left < right ? 1 : 0;
      }
    }

    let hash = '';
    for (let i = 0; i < difference.length; i += 4) {
      const chunk = difference.slice(i, i + 4);
      hash += Number.parseInt(chunk, 2).toString(16);
    }

    return hash;
  };

  const [output, color, placeholder, hash] = await Promise.all([getOutput(), getColor(), getPlaceholder(), getHash()]);

  return {
    buffer: output.data,
    format: output.info.format,
    size: output.info.size,
    width: output.info.width,
    height: output.info.height,
    color,
    placeholder,
    hash,
  };
};

type DirectUploadImageParams = {
  userId?: string;
  name: string;
  source: ImageSource;
  bounds?: ImageBounds;
};
export const directUploadImage = async ({ userId, name, source, bounds }: DirectUploadImageParams) => {
  const res = await finalizeImage(source, bounds);

  const key = aws.createS3ObjectKey('images');
  const ext = res.format;
  const path = `${key}.${ext}`;

  await aws.s3.send(
    new PutObjectCommand({
      Bucket: 'penxle-data',
      Key: path,
      Body: res.buffer,
      ContentType: `image/${res.format}`,
    }),
  );

  const [image] = await database
    .insert(Images)
    .values({
      userId,
      name,
      format: `image/${res.format}`,
      size: res.size,
      width: res.width,
      height: res.height,
      path,
      color: res.color,
      placeholder: res.placeholder,
      hash: res.hash,
    })
    .returning({ id: Images.id });

  return image.id;
};

type GeneratePostFragmentImageParams = {
  title: string;
  space: string;
  body: string;
  font: string;
  size: string;
  color: string;
  background: string;
};
export const generatePostShareImage = async ({
  title,
  space,
  body,
  font,
  size,
  color,
  background,
}: GeneratePostFragmentImageParams) => {
  const logo =
    // spell-checker:disable-next-line
    'data:image/svg+xml,%3Csvg width="71" height="12" viewBox="0 0 71 12" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cg opacity="0.2"%3E%3Cpath fill-rule="evenodd" clip-rule="evenodd" d="M2 0C0.895431 0 0 0.895431 0 2V10C0 11.1046 0.895431 12 2 12H10C11.1046 12 12 11.1046 12 10V2C12 0.895431 11.1046 0 10 0H2ZM3.68811 7.76833C3.9478 7.08242 4.90248 4.56084 3.73813 2C3.73813 2 5.86116 4.6302 8.98178 4.96935C8.98178 4.96935 7.95368 7.73228 8.6618 10.1094L6.87122 7.00801C7.02124 6.83258 7.05249 6.57486 6.93051 6.36357C6.77577 6.09556 6.43307 6.00374 6.16506 6.15847C5.89705 6.31321 5.80523 6.65591 5.95996 6.92392C6.0914 7.15158 6.35848 7.25211 6.60019 7.18237L7.62597 8.89638L8.42661 10.2831C7.66102 9.4998 6.06865 8.22877 3.62995 7.95019C3.61959 7.94932 3.64368 7.8857 3.68811 7.76833Z" fill="currentColor"/%3E%3Cpath d="M15.6982 11.25V0.75H19.1815C21.7397 0.75 23.3584 2.094 23.3584 4.208C23.3584 6.056 21.9565 7.82 19.1815 7.82H18.0975V11.25H15.6982ZM18.0541 5.888H19.167C20.2799 5.888 20.9592 5.216 20.9592 4.222C20.9592 3.34 20.3088 2.682 19.167 2.682H18.0541V5.888Z" fill="currentColor"/%3E%3Cpath d="M24.9855 11.25V0.75H31.793V2.724H27.3847V4.95H31.2871V6.77H27.3847V9.276H31.793V11.25H24.9855Z" fill="currentColor"/%3E%3Cpath d="M33.6941 11.25V0.75H35.9488L40.5594 7.428V0.75H42.814V11.25H40.5594L35.9488 4.684V11.25H33.6941Z" fill="currentColor"/%3E%3Cpath d="M44.3883 11.25V10.2L47.568 5.93L44.5473 1.842V0.75H46.6575L49.1578 4.25L51.4993 0.75H53.3926V1.8L50.4297 5.86L53.595 10.158V11.25H51.4848L48.8688 7.554L46.2817 11.25H44.3883Z" fill="currentColor"/%3E%3Cpath d="M55.1621 11.25V0.75H57.5613V9.276H61.8973V11.25H55.1621Z" fill="currentColor"/%3E%3Cpath d="M63.3908 11.25V0.75H70.1982V2.724H65.79V4.95H69.6924V6.77H65.79V9.276H70.1982V11.25H63.3908Z" fill="currentColor"/%3E%3C/g%3E%3C/svg%3E%0A'.replaceAll(
      'currentColor',
      color,
    );

  const svg = await satori(
    {
      type: 'div',
      props: {
        children: [
          {
            type: 'div',
            props: {
              children: body,
              style: {
                display: 'block',
                fontFamily: font,
                fontSize: size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px',
                // lineHeight: font === 'RIDIBatang' ? '2.215' : '1.875', // 30px for Pretendard, 34px for RIDIBatang
                lineHeight: font === 'RIDIBatang' ? '34px' : '30px', // 30px for Pretendard, 34px for RIDIBatang
                wordBreak: 'break-all',
                lineClamp: 5,
              },
            },
          },
          {
            type: 'div',
            props: {
              children: [
                {
                  type: 'div',
                  props: {
                    children: title,
                    style: {
                      display: 'block',
                      fontFamily: 'Pretendard',
                      fontSize: '14px',
                      lineHeight: '30px',
                      fontWeight: 300,
                      opacity: 0.6,
                      wordBreak: 'break-all',
                      lineClamp: 1,
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    children: space,
                    style: {
                      display: 'block',
                      fontFamily: 'Pretendard',
                      fontSize: '13px',
                      lineHeight: '20px',
                      fontWeight: 300,
                      opacity: 0.36,
                      wordBreak: 'break-all',
                      lineClamp: 1,
                    },
                  },
                },
              ],
              style: {
                display: 'flex',
                flexDirection: 'column',
              },
            },
          },
          {
            type: 'img',
            props: {
              src: logo,
              width: 70,
              height: 12,
              style: {
                position: 'absolute',
                bottom: '24px',
                right: '24px',
              },
            },
          },
        ],
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          height: '100%',
          padding: '48px 24px 80px 24px',
          backgroundColor: background,
          color,
        },
      },
    },
    {
      width: 335,
      height: 335,
      fonts: [
        { name: 'Pretendard', data: PretendardLight, weight: 300, style: 'normal' },
        { name: 'Pretendard', data: PretendardRegular, weight: 400, style: 'normal' },
        { name: 'RIDIBatang', data: RIDIBatang, weight: 400, style: 'normal' },
      ],
      loadAdditionalAsset: async (code, segment) => {
        if (code === 'emoji') {
          const codepoint = twemoji.convert.toCodePoint(segment);
          const svg = await got(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoint}.svg`).text();
          return 'data:image/svg+xml,' + encodeURIComponent(svg);
        }

        return [];
      },
    },
  );

  const img = await renderAsync(svg, {
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
    font: { loadSystemFonts: false },
    fitTo: { mode: 'width', value: 1024 },
  });

  return img.asPng();
};
