import { useLayoutEffect, useRef, useState } from 'react';
import { FAQ_ITEMS } from '../../../data/faq';
import RevealHeading from '../../../components/site/RevealHeading';

function FaqItem({ item, isOpen, onToggle }) {
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.maxHeight = isOpen ? panel.scrollHeight + 'px' : null;
  }, [isOpen]);

  return (
    <div className={`faq-item${isOpen ? ' open' : ''}`}>
      <button className="faq-q" onClick={onToggle}>
        <span>{item.question}</span>
        <span className="plus">+</span>
      </button>
      <div className="faq-panel" ref={panelRef}>
        <p>{item.answer}</p>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const defaultIndex = FAQ_ITEMS.findIndex((it) => it.openByDefault);
  const [openIndex, setOpenIndex] = useState(defaultIndex >= 0 ? defaultIndex : null);

  return (
    <section className="alt" id="faq">
      <div className="wrap">
        <RevealHeading eyebrow="FAQ">Questions fréquentes.</RevealHeading>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={item.question}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
