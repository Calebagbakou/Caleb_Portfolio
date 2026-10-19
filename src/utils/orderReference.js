export function normalizeOrderReference(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatOrderReference(ref) {
  if (typeof ref !== 'string') return ref;
  const normalized = normalizeOrderReference(ref);
  if (!/^CC[A-Z0-9]{12}$/.test(normalized)) return ref;
  return `CC-${normalized.slice(2, 6)}-${normalized.slice(6, 10)}-${normalized.slice(10, 14)}`;
}