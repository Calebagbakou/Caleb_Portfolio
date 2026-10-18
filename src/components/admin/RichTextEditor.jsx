import { useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import {
  EMPTY_RICH_DOCUMENT,
  sanitizeRichDocument,
  validateRichImage,
  validateRichLink,
} from '../../utils/richContent';

const TOOLBAR_ACTIONS = [
  { label: 'Gras', icon: 'bold', action: (editor) => editor.chain().focus().toggleBold().run(), active: (editor) => editor.isActive('bold') },
  { label: 'Italique', icon: 'italic', action: (editor) => editor.chain().focus().toggleItalic().run(), active: (editor) => editor.isActive('italic') },
  { label: 'Souligner', icon: 'underline', action: (editor) => editor.chain().focus().toggleUnderline().run(), active: (editor) => editor.isActive('underline') },
  { label: 'Barré', icon: 'strike', action: (editor) => editor.chain().focus().toggleStrike().run(), active: (editor) => editor.isActive('strike') },
  { label: 'Encadré', icon: 'quote', action: (editor) => editor.chain().focus().toggleBlockquote().run(), active: (editor) => editor.isActive('blockquote') },
  { label: 'Liste numérotée', icon: 'ordered-list', action: (editor) => editor.chain().focus().toggleOrderedList().run(), active: (editor) => editor.isActive('orderedList') },
  { label: 'Liste à puces', icon: 'bullet-list', action: (editor) => editor.chain().focus().toggleBulletList().run(), active: (editor) => editor.isActive('bulletList') },
  { label: 'Séparateur', icon: 'separator', action: (editor) => editor.chain().focus().setHorizontalRule().run() },
];

const TOOLBAR_ICONS = {
  bold: <path d="M7 5h6a3.5 3.5 0 010 7H7zm0 7h7a3.5 3.5 0 010 7H7z" />,
  italic: <path d="M10 5h9M5 19h9M14 5L10 19" />,
  underline: <><path d="M6 4v7a6 6 0 0012 0V4" /><path d="M4 21h16" /></>,
  strike: <><path d="M5 12h14M8 7c.6-1.3 1.8-2 4-2 2.5 0 4 1.2 4 3 0 1.1-.6 2-1.8 2.6M16 17c-.5 1.4-2 2-4 2-2.5 0-4-1.1-4-3" /></>,
  highlight: <><path d="M9 4l7 7-6 6-7-7z" /><path d="M4 20h16M12 17l4 3" /></>,
  quote: <><path d="M5 11h5V6H6a2 2 0 00-2 2v5a3 3 0 003 3" /><path d="M14 11h5V6h-4a2 2 0 00-2 2v5a3 3 0 003 3" /></>,
  'ordered-list': <><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 6h1v3M4 12h2l-2 2h2M4 17h2l-2 2h2" /></>,
  'bullet-list': <><path d="M10 6h10M10 12h10M10 18h10" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></>,
  separator: <path d="M4 8h16M4 16h16" />,
  link: <><path d="M10 13a5 5 0 007.1 0l2-2a5 5 0 00-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 00-7.1 0l-2 2a5 5 0 007.1 7.1l1.1-1.1" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="M21 15l-5-5L5 20" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h9a7 7 0 010 14h-2" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9h-9a7 7 0 000 14h2" /></>,
};

function ToolbarIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TOOLBAR_ICONS[name]}
    </svg>
  );
}

function normalizeDocument(value) {
  return sanitizeRichDocument(value) || EMPTY_RICH_DOCUMENT;
}

export default function RichTextEditor({ value, onChange }) {
  const onChangeRef = useRef(onChange);
  const selectionRef = useRef(null);
  const [message, setMessage] = useState('');
  const [textColor, setTextColor] = useState('#1877f2');
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: (url) => Boolean(validateRichLink(url)),
      }),
      Image.configure({ allowBase64: false, inline: false }),
      Placeholder.configure({ placeholder: 'Rédigez la présentation détaillée du produit…' }),
    ],
    content: normalizeDocument(value),
    editorProps: {
      attributes: {
        class: 'rich-content',
        id: 'shop-product-rich-description',
        'aria-label': 'Présentation détaillée du produit',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChangeRef.current(sanitizeRichDocument(updatedEditor.getJSON()));
      setMessage('');
    },
    onSelectionUpdate: ({ editor: updatedEditor }) => {
      const { from, to } = updatedEditor.state.selection;
      selectionRef.current = { from, to };
    },
  });

  function applyMark(action) {
    if (!editor) return;
    const chain = editor.chain();
    if (selectionRef.current) chain.setTextSelection(selectionRef.current);
    action(chain.focus());
  }

  function changeTextColor(event) {
    const color = event.target.value;
    setTextColor(color);
    applyMark((chain) => chain.setColor(color).run());
  }

  function toggleHighlight() {
    applyMark((chain) => chain.toggleHighlight({ color: '#FFF1A8' }).run());
  }

  function addLink() {
    if (!editor) return;
    const selection = editor.state.selection;
    const currentHref = editor.getAttributes('link').href || '';
    const enteredUrl = window.prompt('Adresse du lien (http, https, mailto ou tel)', currentHref);
    if (enteredUrl === null) return;
    const href = validateRichLink(enteredUrl);
    if (!href) {
      setMessage('Lien refusé : utilisez une adresse http(s), mailto ou tel valide.');
      return;
    }
    if (selection.empty) {
      const text = window.prompt('Texte à afficher pour le lien');
      if (!text?.trim()) return;
      editor.chain().focus().insertContent({
        type: 'text',
        text: text.trim(),
        marks: [{ type: 'link', attrs: { href } }],
      }).run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  function addImage() {
    if (!editor) return;
    const enteredUrl = window.prompt('Adresse HTTPS de l’image');
    if (enteredUrl === null) return;
    const src = validateRichImage(enteredUrl);
    if (!src) {
      setMessage('Image refusée : utilisez une adresse HTTPS valide.');
      return;
    }
    const alt = window.prompt('Texte alternatif décrivant l’image');
    if (!alt?.trim()) {
      setMessage('Ajoutez un texte alternatif pour décrire l’image.');
      return;
    }
    editor.chain().focus().setImage({ src, alt: alt.trim() }).run();
  }

  function setBlockStyle(event) {
    if (!editor) return;
    const level = Number(event.target.value);
    if (level === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
  }

  if (!editor) return <div className="rich-editor-loading" role="status">Chargement de l’éditeur…</div>;

  return (
    <div className="rich-editor">
      <div
        className="rich-editor-toolbar"
        role="toolbar"
        aria-label="Mise en forme de la description"
        onMouseDown={(event) => {
          if (event.target.closest('button')) event.preventDefault();
        }}
      >
        <select
          aria-label="Style de paragraphe"
          title="Style de paragraphe"
          value={editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : '0'}
          onChange={setBlockStyle}
        >
          <option value="0">Normal</option>
          <option value="2">Titre 2</option>
          <option value="3">Titre 3</option>
        </select>
        <span className="rich-editor-toolbar-divider" aria-hidden="true" />
        <label className="rich-editor-color-picker" title="Couleur du texte" style={{ '--text-color': textColor }}>
          <span aria-hidden="true">A</span>
          <input
            type="color"
            aria-label="Couleur du texte"
            value={textColor}
            onMouseDown={() => {
              const { from, to } = editor.state.selection;
              selectionRef.current = { from, to };
            }}
            onChange={changeTextColor}
          />
        </label>
        <button
          type="button"
          aria-label="Surligner en jaune"
          title="Surligner en jaune"
          aria-pressed={editor.isActive('highlight')}
          className={editor.isActive('highlight') ? 'active rich-editor-highlight-button' : 'rich-editor-highlight-button'}
          onClick={toggleHighlight}
        >
          <ToolbarIcon name="highlight" />
        </button>
        <span className="rich-editor-toolbar-divider" aria-hidden="true" />
        {TOOLBAR_ACTIONS.slice(0, 4).map(({ label, icon, action, active }) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            title={label}
            aria-pressed={active ? active(editor) : undefined}
            className={active?.(editor) ? 'active' : ''}
            onClick={() => action(editor)}
          >
            <ToolbarIcon name={icon} />
          </button>
        ))}
        <span className="rich-editor-toolbar-divider" aria-hidden="true" />
        {TOOLBAR_ACTIONS.slice(4).map(({ label, icon, action, active }) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            title={label}
            aria-pressed={active ? active(editor) : undefined}
            className={active?.(editor) ? 'active' : ''}
            onClick={() => action(editor)}
          >
            <ToolbarIcon name={icon} />
          </button>
        ))}
        <span className="rich-editor-toolbar-divider" aria-hidden="true" />
        <button type="button" aria-label="Lien" title="Lien" onClick={addLink}><ToolbarIcon name="link" /></button>
        <button type="button" aria-label="Image" title="Image" onClick={addImage}><ToolbarIcon name="image" /></button>
        <span className="rich-editor-toolbar-divider" aria-hidden="true" />
        <button type="button" aria-label="Annuler" title="Annuler" onClick={() => editor.chain().focus().undo().run()}><ToolbarIcon name="undo" /></button>
        <button type="button" aria-label="Rétablir" title="Rétablir" onClick={() => editor.chain().focus().redo().run()}><ToolbarIcon name="redo" /></button>
      </div>
      <div className="rich-editor-canvas">
        <EditorContent editor={editor} />
      </div>
      {message && <p className="rich-editor-message" role="alert">{message}</p>}
    </div>
  );
}
