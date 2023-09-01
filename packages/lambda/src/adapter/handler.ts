import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installPolyfills } from '@sveltejs/kit/node/polyfills';
import { manifest, prerendered } from '0MANIFEST';
import { Server } from '0SERVER';
import mime from 'mime-types';
import { router } from '../http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { LambdaRequest } from '../http';

installPolyfills();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new Server(manifest);
await server.init({ env: process.env as Record<string, string> });

const assets = async (_: LambdaRequest, event: APIGatewayProxyEventV2) => {
  const pathname = event.rawPath.slice(1);

  if (manifest.assets.has(pathname) || pathname.startsWith(manifest.appPath)) {
    const buffer = await fs.readFile(path.join(__dirname, 'public', pathname));
    const immutable = pathname.startsWith(`${manifest.appPath}/immutable`);

    return new Response(buffer, {
      headers: {
        'content-type': mime.lookup(pathname) || 'application/octet-stream',
        'cache-control': immutable
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      },
    });
  }
};

const prerender = async (_: LambdaRequest, event: APIGatewayProxyEventV2) => {
  const pathname = event.rawPath;

  if (prerendered.has(pathname)) {
    const candidates = [
      path.join(__dirname, 'public', `${pathname}.html`),
      path.join(__dirname, 'public', pathname, 'index.html'),
    ];

    for (const candidate of candidates) {
      if (!(await fs.stat(candidate).catch(() => null))) {
        continue;
      }

      const buffer = await fs.readFile(candidate);

      return new Response(buffer, {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      });
    }
  }
};

const sveltekit = async (
  request: LambdaRequest,
  event: APIGatewayProxyEventV2,
) => {
  const response = await server.respond(request, {
    getClientAddress: () => {
      const xff = request.headers.get('x-forwarded-for');
      return xff
        ? xff.split(',')[0].trim()
        : event.requestContext.http.sourceIp;
    },
    platform: { event },
  });

  if (response.headers.get('cache-control') === null) {
    response.headers.set('cache-control', 'private, no-cache');
  }

  return response;
};

export const error = () => {
  return 'Internal server error !!';
};

router.all('*', assets, prerender, sveltekit, error);

export { handler } from '../http';