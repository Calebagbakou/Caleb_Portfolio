export const DOWNLOAD_EXTENSIONS = Object.freeze([
  'apk', 'xapk', 'apks', 'apkm', 'zip', 'rar', '7z', 'exe', 'msi', 'dmg', 'pkg', 'ipa', 'pdf',
]);

const CONTENT_TYPES = Object.freeze({
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
});

const DOWNLOAD_EXTENSION_SET = new Set(DOWNLOAD_EXTENSIONS);

export function getDownloadExtension(filename) {
  const match = String(filename || '').match(/\.([a-z0-9]+)$/i);
  const extension = match?.[1]?.toLowerCase();
  return extension && DOWNLOAD_EXTENSION_SET.has(extension) ? extension : null;
}

export function isValidDownloadFilename(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) return false;
  if (/[\/\\'"“”‘’\r\n]/u.test(value)) return false;
  return getDownloadExtension(value) !== null;
}

function sanitizeFilename(value) {
  return String(value || '')
    .replace(/[\r\n"'“”‘’]/g, '')
    .replace(/[\/\\]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function getFilenameFromContentDisposition(value) {
  if (!value) return '';
  const encoded = value.match(/(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ''));
    } catch {
      // Fall through to the plain filename parameter.
    }
  }
  const quoted = value.match(/(?:^|;)\s*filename\s*=\s*"((?:\\.|[^"])*)"/i)?.[1];
  if (quoted) return quoted.replace(/\\(["\\])/g, '$1');
  return value.match(/(?:^|;)\s*filename\s*=\s*([^;]+)/i)?.[1]?.trim() || '';
}

function resolveFilename(storedFilename, upstreamDisposition) {
  const stored = sanitizeFilename(storedFilename);
  if (!stored) throw new Error('Le nom du fichier est absent.');
  if (getDownloadExtension(stored)) return stored;

  const upstreamFilename = sanitizeFilename(getFilenameFromContentDisposition(upstreamDisposition));
  const extension = getDownloadExtension(upstreamFilename);
  if (!extension) {
    throw new Error('Nom de fichier sans extension reconnue.');
  }

  const baseName = stored.replace(/\.[^.]*$/, '').trim();
  if (!baseName) throw new Error('Le nom du fichier est absent.');
  return `${baseName}.${extension}`;
}

function encodeFilename(filename) {
  return encodeURIComponent(filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function getAsciiFilename(filename) {
  return filename
    .replace(/["\r\n]/g, '')
    .replace(/[\/\\]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_');
}

export function buildDownloadHeaders(
  storedFilename,
  upstreamDisposition = '',
  upstreamContentType = '',
) {
  const filename = resolveFilename(storedFilename, upstreamDisposition);
  const extension = getDownloadExtension(filename);
  const contentType = CONTENT_TYPES[extension] || upstreamContentType || 'application/octet-stream';
  const asciiFilename = getAsciiFilename(filename);

  return {
    filename,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeFilename(filename)}`,
    'X-Content-Type-Options': 'nosniff',
  };
}

export function monitorDownloadStream(body, expectedLength) {
  const reader = body.getReader();
  let bytesSent = 0;
  let loggedInterruption = false;

  function reportInterruption() {
    if (loggedInterruption || expectedLength === null || bytesSent >= expectedLength) return;
    loggedInterruption = true;
    console.error('Le flux de téléchargement a été interrompu avant sa longueur annoncée.', {
      bytesSent,
      expectedBytes: expectedLength,
    });
  }

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          reportInterruption();
          controller.close();
          return;
        }
        bytesSent += value.byteLength;
        controller.enqueue(value);
      } catch {
        reportInterruption();
        controller.error(new Error('Le flux de téléchargement a été interrompu.'));
      }
    },
    async cancel(reason) {
      reportInterruption();
      await reader.cancel(reason);
    },
  });
}
