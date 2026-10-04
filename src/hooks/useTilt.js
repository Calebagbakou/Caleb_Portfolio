import { useEffect, useRef } from 'react';

/**
 * Port du léger effet de tilt 3D au survol (pointeurs fins uniquement),
 * identique à l'ancien script.js.
 */
export function useTilt() {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return;
    const el = ref.current;
    if (!el) return;

    function onMove(e) {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `translateY(-4px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`;
    }
    function onLeave() {
      el.style.transform = '';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return ref;
}
