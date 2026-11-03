import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import worker from './backend/worker.mjs';

const root = resolve(new URL('.', import.meta.url).pathname);
const port = Number(process.env.PORT || 8787);
const dbPath = resolve(process.env.DB_PATH || '/var/lib/tti/tti.sqlite3');
const photosRoot = resolve(process.env.PHOTOS_DIR || '/var/lib/tti/photos');
const distRoot = resolve(process.env.DIST_DIR || resolve(root, 'dist'));
const maxRequestBytes = Number(process.env.MAX_REQUEST_BYTES || 220 * 1024 * 1024);

await mkdir(dirname(dbPath), { recursive: true });
await mkdir(photosRoot, { recursive: true });

const sqlite = new DatabaseSync(dbPath);
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

class LocalStatement {
  constructor(database, sql, params = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) { return new LocalStatement(this.database, this.sql, params); }
  all() {
    const results = this.database.prepare(this.sql).all(...this.params);
    return Promise.resolve({ success: true, results, meta: { changes: 0 } });
  }
  first(column) {
    const row = this.database.prepare(this.sql).get(...this.params);
    if (row === undefined) return Promise.resolve(null);
    return Promise.resolve(column ? (row[column] ?? null) : row);
  }
  run() { return Promise.resolve(this.runSync()); }
  runSync() {
    const result = this.database.prepare(this.sql).run(...this.params);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes || 0),
        last_row_id: Number(result.lastInsertRowid || 0),
      },
    };
  }
  batchSync() {
    if (/^\s*(?:SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(this.sql)) {
      const results = this.database.prepare(this.sql).all(...this.params);
      return { success: true, results, meta: { changes: 0 } };
    }
    return this.runSync();
  }
}

const DB = {
  prepare(sql) { return new LocalStatement(sqlite, sql); },
  async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.batchSync());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      try { sqlite.exec('ROLLBACK'); } catch {}
      throw error;
    }
  },
};

function safePath(base, key) {
  const target = resolve(base, String(key).replace(/^[/\\]+/, ''));
  if (target !== base && !target.startsWith(base + sep)) throw new Error('Invalid storage key');
  return target;
}

function imageContentType(body) {
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => body[index] === value)) return 'image/png';
  if (body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

const PHOTOS = {
  async get(key) {
    const file = safePath(photosRoot, key);
    try {
      const [body, metadataText] = await Promise.all([
        readFile(file),
        readFile(file + '.metadata.json', 'utf8').catch(() => '{}'),
      ]);
      const metadata = JSON.parse(metadataText);
      return { body, httpMetadata: { contentType: metadata.contentType || imageContentType(body) } };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  },
  async put(key, value, options = {}) {
    const file = safePath(photosRoot, key);
    await mkdir(dirname(file), { recursive: true });
    const temporary = file + `.tmp-${process.pid}-${Date.now()}`;
    const body = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    await writeFile(temporary, body);
    await rename(temporary, file);
    await writeFile(file + '.metadata.json', JSON.stringify({
      contentType: options.httpMetadata?.contentType || 'application/octet-stream',
    }));
    return null;
  },
  async delete(key) {
    const file = safePath(photosRoot, key);
    await Promise.all([rm(file, { force: true }), rm(file + '.metadata.json', { force: true })]);
  },
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'], ['.kml', 'application/vnd.google-earth.kml+xml'],
  ['.kmz', 'application/vnd.google-earth.kmz'],
]);

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad Request', { status: 400 }); }
    if (pathname === '/') pathname = '/index.html';
    let file;
    try { file = safePath(distRoot, pathname); } catch { return new Response('Forbidden', { status: 403 }); }
    try {
      if (!(await stat(file)).isFile()) throw Object.assign(new Error(), { code: 'ENOENT' });
      const body = await readFile(file);
      return new Response(body, { headers: { 'Content-Type': mimeTypes.get(extname(file).toLowerCase()) || 'application/octet-stream' } });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return new Response('Not Found', { status: 404 });
    }
  },
};

const environment = {
  DB,
  PHOTOS,
  ASSETS,
  ALLOWED_CLIENT_IP: process.env.ALLOWED_CLIENT_IP || '92.180.22.209',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://tti.proconect.online,https://tti-test.proconect.online,https://prevent.proconect.online',
  MAPBOX_PUBLIC_TOKEN: process.env.MAPBOX_PUBLIC_TOKEN || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw Object.assign(new Error('Request too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || 'tti.proconect.online';
    const url = `https://${host}${incoming.url || '/'}`;
    const method = incoming.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(incoming);
    const request = new Request(url, { method, headers: incoming.headers, body });
    const response = await worker.fetch(request, environment, {});
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    if (method === 'HEAD' || !response.body) return outgoing.end();
    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    console.error(error);
    outgoing.statusCode = error?.statusCode || 500;
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
    outgoing.end(JSON.stringify({ error: outgoing.statusCode === 413 ? 'Cererea este prea mare.' : 'Eroare internă.' }));
  }
});

server.listen(port, '127.0.0.1', () => console.log(`TTI local listening on http://127.0.0.1:${port}`));

function shutdown() {
  server.close(() => { sqlite.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
