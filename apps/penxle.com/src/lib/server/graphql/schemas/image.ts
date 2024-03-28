import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq } from 'drizzle-orm';
import * as R from 'radash';
import { useCache } from '$lib/server/cache';
import { database, Images, PostRevisionContents, PostRevisions, Posts } from '$lib/server/database';
import { aws } from '$lib/server/external-api';
import { finalizeImage } from '$lib/server/utils';
import { builder } from '../builder';
import { createObjectRef } from '../utils';
import type { ImageBounds } from '$lib/utils';

/**
 * * Types
 */

export const Image = createObjectRef('Image', Images);
Image.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    width: t.exposeInt('width'),
    height: t.exposeInt('height'),
    placeholder: t.exposeString('placeholder'),

    url: t.string({
      resolve: (parent) => `https://glyph.pub/${parent.path}`,
    }),
  }),
});

const PrepareImageUploadResult = builder.simpleObject('PrepareImageUploadResult', {
  fields: (t) => ({
    key: t.string(),
    presignedUrl: t.string(),
  }),
});

/**
 * * Inputs
 */

const FinalizeImageUploadInput = builder.inputType('FinalizeImageUploadInput', {
  fields: (t) => ({
    key: t.string(),
    name: t.string(),
    bounds: t.field({ type: 'JSON', required: false }),
  }),
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  authLayoutBackgroundImage: t.field({
    type: Image,
    nullable: true,
    resolve: async () => {
      return await useCache(
        'authLayoutBackgroundImage',
        async () => {
          const posts = await database
            .select({ content: PostRevisionContents.data })
            .from(Posts)
            .innerJoin(PostRevisions, eq(PostRevisions.id, Posts.publishedRevisionId))
            .innerJoin(PostRevisionContents, eq(PostRevisionContents.id, PostRevisions.freeContentId))
            .where(eq(Posts.id, 'authlayout_bg'));

          if (posts.length === 0) {
            return null;
          }

          const ids = (posts[0].content as { type: string; attrs: Record<string, unknown> }[])
            .filter(({ type }) => type === 'image')
            .map(({ attrs }) => attrs.id as string);

          return R.draw(ids);
        },
        10,
      );
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  prepareImageUpload: t.withAuth({ user: true }).field({
    type: PrepareImageUploadResult,
    resolve: async () => {
      const key = aws.createS3ObjectKey('images');

      const presignedUrl = await getSignedUrl(
        aws.s3,
        new PutObjectCommand({
          Bucket: 'penxle-uploads',
          Key: key,
        }),
        { expiresIn: 60 * 60 }, // 1 hour
      );

      return {
        key,
        presignedUrl,
      };
    },
  }),

  finalizeImageUpload: t.withAuth({ user: true }).field({
    type: Image,
    args: { input: t.arg({ type: FinalizeImageUploadInput }) },
    resolve: async (_, { input }, context) => {
      const object = await aws.s3.send(
        new GetObjectCommand({
          Bucket: 'penxle-uploads',
          Key: input.key,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const source = await object.Body!.transformToByteArray();
      const res = await finalizeImage(source, input.bounds as ImageBounds);

      const key = aws.createS3ObjectKey('images');
      const ext = input.name.split('.').pop() ?? 'unk';
      const path = `${key}.${ext}`;

      await aws.s3.send(
        new PutObjectCommand({
          Bucket: 'penxle-data',
          Key: path,
          Body: res.buffer,
          ContentType: object.ContentType ?? `image/${res.format}`,
        }),
      );

      await aws.s3.send(
        new DeleteObjectCommand({
          Bucket: 'penxle-uploads',
          Key: input.key,
        }),
      );

      const [image] = await database
        .insert(Images)
        .values({
          userId: context.session.userId,
          name: input.name,
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
    },
  }),
}));
