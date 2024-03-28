import fs from 'node:fs/promises';
import path from 'node:path';
import type { Adapter } from '@sveltejs/kit';

export const docker = (): Adapter => {
  return {
    name: '@penxle/adapter-docker',
    adapt: async (builder) => {
      const out = 'dist';

      const prerendered: Record<string, string> = {};
      for (const [p, { file }] of builder.prerendered.pages.entries()) {
        prerendered[p] = file;
      }

      builder.rimraf(out);
      builder.mkdirp(out);

      builder.writeServer(path.join(out, 'server'));
      builder.writeClient(path.join(out, 'client'));
      builder.writePrerendered(path.join(out, 'client'));

      await fs.appendFile(
        path.join(out, 'server/manifest.js'),
        `export const prerendered = ${JSON.stringify(prerendered)};`,
      );

      await fs.writeFile(
        path.join(out, 'index.js'),
        `
          import path from 'node:path';
          import { fileURLToPath } from 'node:url';
          import { serve } from '@penxle/adapter-docker/server';
          import { Server } from './server/index.js';
          import { manifest, prerendered } from './server/manifest.js';

          const basePath = path.dirname(fileURLToPath(import.meta.url));

          await serve({ basePath, Server, manifest, prerendered });
        `,
      );
    },
  };
};
