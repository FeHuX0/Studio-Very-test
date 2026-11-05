import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface StoredProject {
  id: string;
  title: string;
  body: Record<string, unknown>;
  updated: string;
}

interface StoreData {
  assets: Record<string, Record<string, unknown>>;
  projects: Record<string, StoredProject>;
}

function loadStore(filePath: string): StoreData {
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<StoreData>;
      return { assets: parsed.assets ?? {}, projects: parsed.projects ?? {} };
    }
  } catch {
    // Fallback to empty store on corrupted file
  }
  return { assets: {}, projects: {} };
}

function saveStore(filePath: string, data: StoreData): void {
  const dir = resolve(filePath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) {
        rejectBody(new Error('Размер запроса превышает 20 МБ'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolveBody(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        rejectBody(new Error('Некорректный JSON'));
      }
    });
    req.on('error', rejectBody);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function formaApiPlugin(): Plugin {
  const dataDir = process.env.FORMA_DATA_DIR || '.data';
  const storePath = resolve(process.cwd(), dataDir, 'forma-store.json');

  const attachMiddleware = (middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }) => {
    middlewares.use(async (req, res, next) => {
      const url = req.url?.split('?')[0] ?? '';
      if (!url.startsWith('/api')) {
        next();
        return;
      }

      const store = loadStore(storePath);

      if (req.method === 'GET' && url === '/api/health') {
        sendJson(res, 200, { status: 'ok', semanticMode: 'local', aiEnabled: false });
        return;
      }

      if (req.method === 'GET' && url === '/api/assets') {
        const list = Object.keys(store.assets)
          .sort()
          .map(id => store.assets[id]);
        sendJson(res, 200, list);
        return;
      }

      if (req.method === 'POST' && url === '/api/assets') {
        try {
          const body = await readJsonBody(req);
          const assets = Array.isArray(body.assets) ? (body.assets as Record<string, unknown>[]) : [];
          for (const asset of assets) {
            const id = String(asset.id ?? '');
            if (!id) continue;
            const prev = store.assets[id];
            if (prev) {
              const prevSources = (prev.sources as Record<string, unknown>) ?? {};
              const nextSources = (asset.sources as Record<string, unknown>) ?? {};
              const prevVariants = Array.isArray(prev.sizeVariants) ? (prev.sizeVariants as string[]) : [];
              const nextVariants = Array.isArray(asset.sizeVariants) ? (asset.sizeVariants as string[]) : [];
              store.assets[id] = {
                ...asset,
                sources: { ...prevSources, ...nextSources },
                sizeVariants: [...new Set([...prevVariants, ...nextVariants])].sort(),
              };
            } else {
              store.assets[id] = asset;
            }
          }
          saveStore(storePath, store);
          sendJson(res, 200, { saved: assets.length });
        } catch (err) {
          sendJson(res, 400, { detail: (err as Error).message });
        }
        return;
      }

      if (req.method === 'GET' && url === '/api/projects') {
        const list = Object.values(store.projects)
          .sort((a, b) => b.updated.localeCompare(a.updated))
          .slice(0, 100)
          .map(({ id, title, updated }) => ({ id, title, updated }));
        sendJson(res, 200, list);
        return;
      }

      if (req.method === 'POST' && url === '/api/projects') {
        try {
          const project = await readJsonBody(req);
          const composition = (project.composition as Record<string, unknown> | undefined) ?? {};
          const key = (typeof composition.id === 'string' && composition.id) ? composition.id : randomUUID();
          const title = typeof project.title === 'string' && project.title.trim() ? project.title : 'Без названия';
          const updated = new Date().toISOString();
          store.projects[key] = { id: key, title, body: project, updated };
          saveStore(storePath, store);
          sendJson(res, 200, { id: key, updated });
        } catch (err) {
          sendJson(res, 400, { detail: (err as Error).message });
        }
        return;
      }

      const projectMatch = url.match(/^\/api\/projects\/([^/]+)$/);
      if (req.method === 'GET' && projectMatch) {
        const id = decodeURIComponent(projectMatch[1]);
        const found = store.projects[id];
        if (!found) {
          sendJson(res, 404, { detail: 'Проект не найден' });
          return;
        }
        sendJson(res, 200, found.body);
        return;
      }

      sendJson(res, 404, { detail: 'Маршрут не найден' });
    });
  };

  return {
    name: 'forma-api',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), formaApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      ignored: ['**/*.md', '**/.env*', '**/.data/**', '**/.playwright-cli/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: { environment: 'jsdom', include: ['src/services/core.test.ts'] },
});
