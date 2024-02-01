import { webcrypto } from 'node:crypto';
import { createId } from '$lib/utils';
import type { JSONContent } from '@tiptap/core';
import type { InteractiveTransactionClient } from '../prisma';

type RevisePostContentParams = {
  db: InteractiveTransactionClient;
  contentData: JSONContent[];
};

export const revisePostContent = async ({ db, contentData }: RevisePostContentParams) => {
  const contentHash = Buffer.from(
    await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(contentData))),
  ).toString('hex');

  return await db.postRevisionContent.upsert({
    where: { hash: contentHash },
    create: {
      id: createId(),
      hash: contentHash,
      data: contentData,
    },
    update: {},
  });
};
