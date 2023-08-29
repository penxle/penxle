import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { getDominantColor } from '../lib/mmcq';
import type { S3EventRecord, S3Handler } from 'aws-lambda';

const S3 = new S3Client();

export const handler = (async (event) => {
  const promises = event.Records.map(async (record) => {
    try {
      await finalize(record);
    } catch (err) {
      console.error(err);
      // await ddbPutItem(record.s3.object.key, { error: String(err) });
    }
  });

  await Promise.all(promises);
}) satisfies S3Handler;

const finalize = async (record: S3EventRecord) => {
  const key = decodeURIComponent(record.s3.object.key.replaceAll('+', ' '));

  const object = await S3.send(
    new GetObjectCommand({ Bucket: 'penxle-uploads', Key: key }),
  );
  await S3.send(
    new DeleteObjectCommand({ Bucket: 'penxle-uploads', Key: key }),
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const name = decodeURIComponent(object.Metadata!.name);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const buffer = Buffer.from(await object.Body!.transformToByteArray());

  const image = sharp(buffer, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' });

  const metadata = await image.metadata();

  const getOutput = async () => {
    return await image
      .clone()
      .avif({ quality: 75, effort: 4 })
      .toBuffer({ resolveWithObject: true });
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

  const [output, color, placeholder, hash] = await Promise.all([
    getOutput(),
    getColor(),
    getPlaceholder(),
    getHash(),
  ]);

  const path = `${key}.avif`;
  await S3.send(
    new PutObjectCommand({
      Bucket: 'penxle-data',
      Key: path,
      Body: output.data,
      ContentType: 'image/avif',
    }),
  );

  JSON.stringify({
    name,
    path,
    format: metadata.format,
    fileSize: metadata.size,
    blobSize: output.info.size,
    width: output.info.width,
    height: output.info.height,
    color,
    placeholder,
    hash,
  });
};
