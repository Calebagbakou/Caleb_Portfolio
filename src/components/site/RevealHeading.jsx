import { useReveal } from '../../hooks/useReveal';

export default function RevealHeading({ eyebrow, children }) {
  const [ref, visible] = useReveal();

  return (
    <div className={`sec-head reveal${visible ? ' in' : ''}`} ref={ref}>
      <div className="sec-eyebrow">{eyebrow}</div>
      <h2 className="sec-title">{children}</h2>
    </div>
  );
}
