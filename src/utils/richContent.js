const ALLOWED_BLOCK_NODES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'horizontalRule',
  'image',
]);
const ALLOWED_MARKS = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link', 'textStyle', 'highlight']);

export const EMPTY_RICH_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] };

export function validateRichLink(value) {
  if (typeof value !== 'string' || !/^(https?:|mailto:|tel:)/i.test(value.trim())) return null;
  const href = value.trim();
  try {
    const url = new URL(href);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null;
    if (['http:', 'https:'].includes(url.protocol) && !url.hostname) return null;
    return href;
  } catch {
    return null;
  }
}

export function validateRichImage(value) {
  if (typeof value !== 'string' || !/^https:/i.test(value.trim())) return null;
  const src = value.trim();
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname ? src : null;
  } catch {
    return null;
  }
}

function validateRichColor(value) {
  if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return null;
  return value.toLowerCase();
}

function sanitizeMarks(marks) {
  if (!Array.isArray(marks)) return [];
  return marks.flatMap((mark) => {
    if (!mark || !ALLOWED_MARKS.has(mark.type)) return [];
    if (mark.type === 'link') {
      const href = validateRichLink(mark.attrs?.href);
      return href ? [{ type: 'link', attrs: { href } }] : [];
    }
    if (mark.type === 'textStyle' || mark.type === 'highlight') {
      const color = validateRichColor(mark.attrs?.color);
      return color ? [{ type: mark.type, attrs: { color } }] : [];
    }
    return [{ type: mark.type }];
  });
}

function sanitizeInlineNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'text' && typeof node.text === 'string') {
    const textNode = { type: 'text', text: node.text };
    const marks = sanitizeMarks(node.marks);
    if (marks.length) textNode.marks = marks;
    return textNode;
  }
  if (node.type === 'hardBreak') return { type: 'hardBreak' };
  return null;
}

function sanitizeBlockNode(node) {
  if (!node || typeof node !== 'object' || !ALLOWED_BLOCK_NODES.has(node.type)) return null;
  if (node.type === 'horizontalRule') return { type: 'horizontalRule' };
  if (node.type === 'image') {
    const src = validateRichImage(node.attrs?.src);
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    if (!src || !alt) return null;
    return { type: 'image', attrs: { src, alt } };
  }
  if (node.type === 'paragraph' || node.type === 'heading') {
    if (node.type === 'heading' && ![2, 3].includes(node.attrs?.level)) return null;
    const content = (Array.isArray(node.content) ? node.content : [])
      .map(sanitizeInlineNode)
      .filter(Boolean);
    const result = { type: node.type };
    if (node.type === 'heading') result.attrs = { level: node.attrs.level };
    if (content.length) result.content = content;
    return result;
  }

  const content = (Array.isArray(node.content) ? node.content : [])
    .map((child) => {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        return child?.type === 'listItem' ? sanitizeBlockNode(child) : null;
      }
      if (node.type === 'listItem') {
        return child?.type === 'paragraph' || child?.type === 'bulletList' || child?.type === 'orderedList'
          ? sanitizeBlockNode(child)
          : null;
      }
      return ALLOWED_BLOCK_NODES.has(child?.type) ? sanitizeBlockNode(child) : null;
    })
    .filter(Boolean);
  return { type: node.type, ...(content.length ? { content } : {}) };
}

function hasVisibleContent(node) {
  if (!node) return false;
  if (node.type === 'text') return node.text.trim().length > 0;
  if (node.type === 'image' || node.type === 'horizontalRule') return true;
  return (node.content || []).some(hasVisibleContent);
}

export function sanitizeRichDocument(document) {
  if (!document || typeof document !== 'object' || document.type !== 'doc') return null;
  const content = (Array.isArray(document.content) ? document.content : [])
    .map(sanitizeBlockNode)
    .filter(Boolean);
  const result = { type: 'doc', ...(content.length ? { content } : {}) };
  return hasVisibleContent(result) ? result : null;
}
