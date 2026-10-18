import { createElement } from 'react';
import { sanitizeRichDocument, validateRichLink } from '../../utils/richContent';

function renderInline(node, key) {
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type !== 'text') return null;

  let content = node.text;
  (node.marks || []).forEach((mark, index) => {
    if (mark.type === 'link') {
      const href = validateRichLink(mark.attrs?.href);
      if (!href) return;
      const external = /^https?:/i.test(href);
      content = (
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          key={`${key}-mark-${index}`}
        >
          {content}
        </a>
      );
      return;
    }
    if (mark.type === 'textStyle') {
      content = <span key={`${key}-mark-${index}`} style={{ color: mark.attrs.color }}>{content}</span>;
      return;
    }
    if (mark.type === 'highlight') {
      content = <mark key={`${key}-mark-${index}`} style={{ backgroundColor: mark.attrs.color }}>{content}</mark>;
      return;
    }
    const tags = { bold: 'strong', italic: 'em', strike: 's', underline: 'u', code: 'code' };
    const tag = tags[mark.type];
    if (tag) content = createElement(tag, { key: `${key}-mark-${index}` }, content);
  });
  return <span key={key}>{content}</span>;
}

function renderBlock(node, key) {
  if (node.type === 'horizontalRule') return <hr key={key} />;
  if (node.type === 'image') {
    return <img key={key} src={node.attrs.src} alt={node.attrs.alt} loading="lazy" />;
  }

  const children = (node.content || []).map((child, index) => {
    const childKey = `${key}-${index}`;
    return child.type === 'text' || child.type === 'hardBreak'
      ? renderInline(child, childKey)
      : renderBlock(child, childKey);
  });
  const tags = {
    paragraph: 'p',
    heading: node.attrs?.level === 2 ? 'h2' : 'h3',
    bulletList: 'ul',
    orderedList: 'ol',
    listItem: 'li',
    blockquote: 'blockquote',
  };
  const tag = tags[node.type];
  return tag ? createElement(tag, { key }, children) : null;
}

export default function RichContent({ doc, fallbackText = '' }) {
  const safeDocument = sanitizeRichDocument(doc)
    || sanitizeRichDocument({
      type: 'doc',
      content: (typeof fallbackText === 'string' ? fallbackText : '')
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    });
  if (!safeDocument) return null;

  return (
    <section className="rich-content" aria-label="Présentation détaillée">
      {(safeDocument.content || []).map((node, index) => renderBlock(node, `rich-${index}`))}
    </section>
  );
}
