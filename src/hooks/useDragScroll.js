import { useEffect, useRef } from 'react';

/**
 * Port du drag-to-scroll horizontal (pointeur souris/tactile) de l'ancien
 * script.js, appliqué à chaque rangée de portfolio (.p-row-scroll).
 * Empêche aussi qu'un clic déclenché juste après un drag n'ouvre la
 * lightbox par erreur.
 */
export function useDragScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    function down(e) {
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = row.scrollLeft;
      row.classList.add('dragging');
    }
    function move(e) {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      row.scrollLeft = startScroll - dx;
    }
    function stop() {
      isDown = false;
      row.classList.remove('dragging');
    }
    function clickGuard(e) {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
      }
    }

    row.addEventListener('pointerdown', down);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', stop);
    row.addEventListener('pointerleave', stop);
    row.addEventListener('pointercancel', stop);
    row.addEventListener('click', clickGuard, true);

    return () => {
      row.removeEventListener('pointerdown', down);
      row.removeEventListener('pointermove', move);
      row.removeEventListener('pointerup', stop);
      row.removeEventListener('pointerleave', stop);
      row.removeEventListener('pointercancel', stop);
      row.removeEventListener('click', clickGuard, true);
    };
  }, []);

  return ref;
}
