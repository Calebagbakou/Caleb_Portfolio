import { useEffect, useRef } from 'react';

const CONNECTION_DISTANCE = 132;
const POINTER_RADIUS = 150;
const MAX_PARTICLES = 96;

export default function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      console.error('Impossible d’initialiser le fond de particules.');
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0, active: false };
    let particles = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let color = '#ccff00';

    function resize() {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      color = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || color;

      const count = Math.min(MAX_PARTICLES, Math.max(32, Math.round((width * height) / 14500)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        radius: Math.random() * 1.15 + 0.55,
      }));
      draw();
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!reducedMotion.matches) {
          particle.x += particle.vx;
          particle.y += particle.vy;
        }

        if (pointer.active && !reducedMotion.matches) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < POINTER_RADIUS) {
            const force = ((POINTER_RADIUS - distance) / POINTER_RADIUS) * 0.018;
            particle.vx += (dx / distance) * force;
            particle.vy += (dy / distance) * force;
          }
        }

        particle.vx *= 0.995;
        particle.vy *= 0.995;
        particle.vx = Math.max(-0.35, Math.min(0.35, particle.vx));
        particle.vy = Math.max(-0.35, Math.min(0.35, particle.vy));

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;
        particle.x = Math.max(0, Math.min(width, particle.x));
        particle.y = Math.max(0, Math.min(height, particle.y));

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
          if (distance < CONNECTION_DISTANCE) {
            context.globalAlpha = (1 - distance / CONNECTION_DISTANCE) * 0.13;
            context.strokeStyle = color;
            context.lineWidth = 0.7;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.stroke();
          }
        }

        context.globalAlpha = 0.26;
        context.fillStyle = color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
      if (!reducedMotion.matches && !document.hidden) frameId = window.requestAnimationFrame(draw);
    }

    function handlePointerMove(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      if (reducedMotion.matches) draw();
    }

    function handlePointerLeave() {
      pointer.active = false;
    }

    function handleMotionPreferenceChange() {
      window.cancelAnimationFrame(frameId);
      draw();
    }

    function handleVisibilityChange() {
      window.cancelAnimationFrame(frameId);
      if (!document.hidden) draw();
    }

    resize();
    if (!reducedMotion.matches) frameId = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotion.addEventListener('change', handleMotionPreferenceChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotion.removeEventListener('change', handleMotionPreferenceChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
