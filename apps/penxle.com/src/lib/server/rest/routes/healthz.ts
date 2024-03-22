import { sql } from 'drizzle-orm';
import { json } from 'itty-router';
import * as R from 'radash';
import { redis } from '$lib/server/cache';
import { database } from '$lib/server/database';
import { elasticSearch } from '$lib/server/search';
import { createRouter } from '../router';

export const healthz = createRouter();

const checkDatabase = async () => {
  try {
    const r = await database.execute<{ _: number }>(sql`SELECT 1 as _`);
    return R.isEqual(r, [{ _: 1 }]);
  } catch {
    return false;
  }
};

const checkRedis = async () => {
  try {
    const r = await redis.ping();
    return r === 'PONG';
  } catch {
    return false;
  }
};

const checkElasticSearch = async () => {
  try {
    const r = await elasticSearch.ping();
    return r;
  } catch {
    return false;
  }
};

healthz.get('/healthz', async () => {
  const result = await R.all({
    db: checkDatabase(),
    redis: checkRedis(),
    es: checkElasticSearch(),
  });

  const every = Object.values(result).every(Boolean);

  return json(
    {
      '*': every,
      ...result,
    },
    { status: every ? 200 : 500 },
  );
});
