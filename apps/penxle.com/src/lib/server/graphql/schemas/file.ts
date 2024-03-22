import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as mrmime from 'mrmime';
import { database, Files } from '$lib/server/database';
import { aws } from '$lib/server/external-api';
import { builder } from '../builder';
import { createObjectRef } from '../utils';

/**
 * * Types
 */

export const File = createObjectRef('File', Files);
File.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    size: t.exposeInt('size'),

    url: t.string({
      resolve: (parent) => `https://glyph.pub/${parent.path}`,
    }),
  }),
});

const PrepareFileUploadResult = builder.simpleObject('PrepareFileUploadResult', {
  fields: (t) => ({
    key: t.string(),
    presignedUrl: t.string(),
  }),
});

/**
 * * Inputs
 */

const FinalizeFileUploadInput = builder.inputType('FinalizeFileUploadInput', {
  fields: (t) => ({
    key: t.string(),
    name: t.string(),
  }),
});

/**
 * * Queries
 */

// builder.queryFields((t) => ({
// }));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  prepareFileUpload: t.withAuth({ user: true }).field({
    type: PrepareFileUploadResult,
    resolve: async () => {
      const key = aws.createS3ObjectKey('files');

      const presignedUrl = await getSignedUrl(
        aws.s3,
        new PutObjectCommand({
          Bucket: 'penxle-uploads',
          Key: key,
        }),
        { expiresIn: 60 * 60 }, // 1 hour
      );

      return { key, presignedUrl };
    },
  }),

  finalizeFileUpload: t.withAuth({ user: true }).field({
    type: File,
    args: { input: t.arg({ type: FinalizeFileUploadInput }) },
    resolve: async (_, { input }, context) => {
      const object = await aws.s3.send(
        new GetObjectCommand({
          Bucket: 'penxle-uploads',
          Key: input.key,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const buffer = await object.Body!.transformToByteArray();

      const key = aws.createS3ObjectKey('files');
      const ext = input.name.split('.').pop() ?? 'unk';
      const path = `${key}.${ext}`;

      await aws.s3.send(
        new PutObjectCommand({
          Bucket: 'penxle-data',
          Key: path,
          Body: buffer,
          ContentType: object.ContentType,
          ContentDisposition: `attachment; filename="${encodeURIComponent(input.name)}"`,
        }),
      );

      await aws.s3.send(
        new DeleteObjectCommand({
          Bucket: 'penxle-uploads',
          Key: input.key,
        }),
      );

      const [file] = await database
        .insert(Files)
        .values({
          userId: context.session.userId,
          name: input.name,
          format: mrmime.lookup(input.name) ?? 'application/octet-stream',
          size: buffer.byteLength,
          path,
        })
        .returning({ id: Files.id });

      return file.id;
    },
  }),
}));
