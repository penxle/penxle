import { useCache } from '../cache';
import type { InteractiveTransactionClient } from '../prisma';

type GetTagUsageCountParams = {
  tagId: string;
  db: InteractiveTransactionClient;
};
export const getTagUsageCount = ({ tagId, db }: GetTagUsageCountParams) => {
  return useCache(
    `Tag:${tagId}:usageCount`,
    async () =>
      db.postRevisionTag.count({
        where: {
          tagId,
          revision: { kind: 'PUBLISHED' },
        },
      }),
    60 * 60,
  );
};