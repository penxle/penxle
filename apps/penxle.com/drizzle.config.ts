import type { Config } from 'drizzle-kit';

export default {
  strict: true,
  verbose: true,

  schema: './src/lib/server/database/schemas/*',
  out: './drizzle',

  driver: 'pg',
  dbCredentials: {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    connectionString: process.env.PRIVATE_DATABASE_URL!,
  },

  breakpoints: false,
} satisfies Config;
