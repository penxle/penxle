import { disassembleHangulString, InitialHangulString } from '$lib/utils';
import { indexName, openSearch } from '../search';
import type { InteractiveTransactionClient } from '../database';

type IndexPostParams = {
  db: InteractiveTransactionClient;
  postId: string;
};

export const indexPost = async ({ db, postId }: IndexPostParams) => {
  const post = await db.post.findUniqueOrThrow({
    include: {
      publishedRevision: {
        include: {
          tags: {
            include: { tag: true },
          },
        },
      },
    },
    where: { id: postId },
  });

  if (post.publishedRevision) {
    if (post.publishedRevision.kind === 'PUBLISHED' && post.visibility === 'PUBLIC' && post.password === null) {
      await openSearch.index({
        index: indexName('posts'),
        id: post.id,
        body: {
          title: post.publishedRevision.title,
          subtitle: post.publishedRevision.subtitle,
          publishedAt: post.publishedAt?.getTime() ?? Date.now(),
          tags: post.publishedRevision.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, nameRaw: tag.name })),
          contentFilters: post.contentFilters,
          spaceId: post.spaceId,
        },
      });
    } else {
      try {
        await openSearch.delete({
          index: indexName('posts'),
          id: post.id,
        });
      } catch {
        /* empty */
      }
    }
  }
};

type IndexSpaceParams = {
  db: InteractiveTransactionClient;
  spaceId: string;
};

export const indexSpace = async ({ db, spaceId }: IndexSpaceParams) => {
  const space = await db.space.findUniqueOrThrow({
    where: { id: spaceId },
  });

  if (space.state === 'ACTIVE' && space.visibility === 'PUBLIC') {
    await openSearch.index({
      index: indexName('spaces'),
      id: space.id,
      body: {
        name: space.name,
      },
    });
  } else {
    try {
      await openSearch.delete({
        index: indexName('spaces'),
        id: space.id,
      });
    } catch {
      /* empty */
    }
  }
};

type IndexTagParams = {
  tags: {
    id: string;
    name: string;
  }[];
};

export const indexTags = async ({ tags }: IndexTagParams) => {
  if (tags.length === 0) return;

  const disassembledTags = tags.map(({ id, name }) => ({
    id,
    name: {
      raw: name,
      disassembled: disassembleHangulString(name),
      initial: InitialHangulString(name) || null,
    },
  }));

  await openSearch.bulk({
    index: indexName('tags'),
    body: disassembledTags.flatMap((tag) => [{ index: { _id: tag.id } }, { name: tag.name }]),
  });
};
