import { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    function update() {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      setWidth(max > 0 ? (scrolled / max) * 100 : 0);
    }
    document.addEventListener('scroll', update, { passive: true });
    update();
    return () => document.removeEventListener('scroll', update);
  }, []);

  return <div className="progress" style={{ width: `${width}%` }} />;
}
