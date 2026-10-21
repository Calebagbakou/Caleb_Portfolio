import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  buildDownloadHeaders,
  isValidDownloadFilename,
} from '../supabase/functions/_shared/downloadFile.mjs';
import { createDownloadHandler } from '../supabase/functions/shop-download/handler.mjs';

const token = '123e4567-e89b-12d3-a456-426614174000';
const sourceUrl = 'https://downloads.example.com/file';
const fileBytes = Buffer.from('apk-file-content');
let deliverySourceUrl = sourceUrl;

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createClient(download) {
  return {
    from(table) {
      let tokenHash = '';
      return {
        select() { return this; },
        eq(field, value) {
          if (table === 'shop_download_tokens' && field === 'token_hash') tokenHash = value;
          return this;
        },
        async maybeSingle() {
          if (table === 'shop_download_tokens') {
            return { data: tokenHash === download.tokenHash ? download.data : null, error: null };
          }
          return { data: { access_url: deliverySourceUrl }, error: null };
        },
      };
    },
  };
}

test('download filenames, content types and stream handling', async (t) => {
  const server = createServer((request, response) => {
    if (request.url === '/html') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': '20' });
      response.end('<html>Login page</html>');
      return;
    }
    if (request.url === '/range') {
      response.writeHead(206, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="CapCut-Pro-14.2.0.apk"',
        'Content-Length': '4',
        'Content-Range': 'bytes 0-3/16',
      });
      response.end('part');
      return;
    }
    if (request.url === '/interrupted') {
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="CapCut-Pro-14.2.0.apk"',
        'Content-Length': '100',
      });
      response.write('short');
      setTimeout(() => response.destroy(), 20);
      return;
    }
    if (request.url === '/no-disposition') {
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': '4',
      });
      response.end('data');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="CapCut-Pro-14.2.0.apk"',
      'Content-Length': String(fileBytes.length),
      'Accept-Ranges': 'bytes',
    });
    response.end(fileBytes);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const port = server.address().port;
  let downloadRecord = {
    tokenHash: await hash(token),
    data: {
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      orders: { payment_status: 'confirme' },
      product_id: 'product-1',
      products: { download_filename: 'CapCut-Pro-14.2.0.apk' },
    },
  };
  let sourcePath = '/file';
  let fetchCalls = 0;
  const fetchImpl = (url, options) => {
    fetchCalls += 1;
    const target = new URL(url);
    return fetch(`http://127.0.0.1:${port}${sourcePath}${target.search}`, options);
  };
  const handler = createDownloadHandler({
    getServiceClient: () => createClient(downloadRecord),
    fetchImpl,
  });
  const invoke = (value = token, headers = {}) =>
    handler(new Request(`https://edge.example.com/shop-download?token=${value}`, { headers }));

  const cases = [
    {
      input: 'CapCut-Pro-14.2.0.apk',
      upstream: '',
      disposition: 'attachment; filename="CapCut-Pro-14.2.0.apk"; filename*=UTF-8\'\'CapCut-Pro-14.2.0.apk',
      contentType: 'application/vnd.android.package-archive',
    },
    {
      input: 'Capcut Pro été.apk',
      upstream: '',
      disposition: 'attachment; filename="Capcut Pro _t_.apk"; filename*=UTF-8\'\'Capcut%20Pro%20%C3%A9t%C3%A9.apk',
      contentType: 'application/vnd.android.package-archive',
    },
    {
      input: 'fichier.zip',
      upstream: '',
      disposition: 'attachment; filename="fichier.zip"; filename*=UTF-8\'\'fichier.zip',
      contentType: 'application/zip',
    },
    {
      input: 'fichier',
      upstream: 'attachment; filename="fichier.zip"',
      disposition: 'attachment; filename="fichier.zip"; filename*=UTF-8\'\'fichier.zip',
      contentType: 'application/zip',
    },
    {
      input: 'x"y.apk',
      upstream: '',
      disposition: 'attachment; filename="xy.apk"; filename*=UTF-8\'\'xy.apk',
      contentType: 'application/vnd.android.package-archive',
    },
  ];

  const contentTypes = {
    apk: 'application/vnd.android.package-archive',
    xapk: 'application/octet-stream',
    apks: 'application/octet-stream',
    apkm: 'application/octet-stream',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    exe: 'application/vnd.microsoft.portable-executable',
    msi: 'application/x-msi',
    dmg: 'application/x-apple-diskimage',
    pkg: 'application/octet-stream',
    pdf: 'application/pdf',
    ipa: 'application/octet-stream',
  };
  for (const [extension, expectedType] of Object.entries(contentTypes)) {
    assert.equal(
      buildDownloadHeaders(`fichier.${extension}`, '', 'text/plain')['Content-Type'],
      expectedType,
    );
  }

  for (const scenario of cases) {
    const headers = buildDownloadHeaders(scenario.input, scenario.upstream, 'application/octet-stream');
    assert.equal(headers['Content-Disposition'], scenario.disposition);
    assert.equal(headers['Content-Type'], scenario.contentType);
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  }
  assert.throws(() => buildDownloadHeaders('fichier', '', 'application/octet-stream'), /extension reconnue/);
  assert.equal(isValidDownloadFilename('CapCut-Pro.apk'), true);
  assert.equal(isValidDownloadFilename('fichier'), false);
  assert.equal(isValidDownloadFilename('fichier.apk/extra'), false);
  assert.equal(isValidDownloadFilename('x"y.apk'), false);

  const response = await invoke();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), cases[0].disposition);
  assert.equal(response.headers.get('content-type'), 'application/vnd.android.package-archive');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-length'), String(fileBytes.length));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fileBytes);

  sourcePath = '/range';
  const rangeResponse = await invoke(token, { Range: 'bytes=0-3' });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers.get('content-range'), 'bytes 0-3/16');
  assert.equal(rangeResponse.headers.get('content-length'), '4');
  assert.equal(await rangeResponse.text(), 'part');

  const callsBeforeRejectedTokens = fetchCalls;
  assert.equal((await invoke('not-a-token')).status, 404);
  downloadRecord.data.expires_at = new Date(Date.now() - 60_000).toISOString();
  assert.equal((await invoke()).status, 410);
  downloadRecord.data.expires_at = new Date(Date.now() + 60_000).toISOString();
  downloadRecord.data.orders.payment_status = 'en_attente';
  assert.equal((await invoke()).status, 403);
  assert.equal(fetchCalls, callsBeforeRejectedTokens);
  downloadRecord.data.orders.payment_status = 'confirme';
  deliverySourceUrl = 'http://127.0.0.1/private-file';
  assert.equal((await invoke()).status, 502);
  assert.equal(fetchCalls, callsBeforeRejectedTokens);
  deliverySourceUrl = sourceUrl;

  sourcePath = '/html';
  const htmlResponse = await invoke();
  assert.equal(htmlResponse.status, 502);
  assert.match(await htmlResponse.text(), /L’hébergeur n’a pas fourni directement le fichier/);

  sourcePath = '/no-disposition';
  downloadRecord.data.products.download_filename = 'fichier';
  const missingFilenameExtension = await invoke();
  assert.equal(missingFilenameExtension.status, 409);
  assert.equal(await missingFilenameExtension.text(), 'Téléchargement indisponible, contactez le support');
  downloadRecord.data.products.download_filename = 'CapCut-Pro-14.2.0.apk';

  sourcePath = '/interrupted';
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const interrupted = await invoke();
    assert.equal(interrupted.status, 200);
    await assert.rejects(interrupted.arrayBuffer());
  } finally {
    console.error = originalConsoleError;
  }
  assert.ok(logged.some((line) => line.includes('interrompu')));
  assert.ok(logged.every((line) => !line.includes(token) && !line.includes(sourceUrl)));
});
