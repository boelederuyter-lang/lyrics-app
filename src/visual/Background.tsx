import { useEffect, useLayoutEffect, useRef } from 'react';
import { beatAt, beatPulse, type BeatGrid } from '../beat/tempo';
import { hsl, type Hsl, type Palette } from './palette';

interface Props {
  palette: Palette;
  getTime: () => number;
  grid: BeatGrid;
  paused: boolean;
  /** Verandert bij elke nieuwe lyric-regel: triggert een particle burst. */
  lineKey: number;
  /** Refrein: alles iets heftiger. */
  hype: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: Hsl;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  speed: number;
  life: number;
  width: number;
  color: Hsl;
}

interface Dust {
  x: number;
  y: number;
  speed: number;
  size: number;
  color: number;
  wobble: number;
}

const BLOBS = 5;

function lerpHue(a: number, b: number, k: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * k + 360) % 360;
}

function lerpHsl(a: Hsl, b: Hsl, k: number): Hsl {
  return [lerpHue(a[0], b[0], k), a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function Background(props: Props) {
  const blobRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const blobCanvas = blobRef.current!;
    const fxCanvas = fxRef.current!;
    const bctx = blobCanvas.getContext('2d')!;
    const fctx = fxCanvas.getContext('2d')!;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      fxCanvas.width = Math.round(w * dpr);
      fxCanvas.height = Math.round(h * dpr);
      // Blobs op lage resolutie: de browser schaalt ze zacht op = gratis blur.
      blobCanvas.width = Math.ceil(w / 8);
      blobCanvas.height = Math.ceil(h / 8);
    };
    resize();
    window.addEventListener('resize', resize);

    let colors = propsRef.current.palette.colors.map((c) => [...c] as Hsl);
    let base = [...propsRef.current.palette.base] as Hsl;
    const particles: Particle[] = [];
    const rings: Ring[] = [];
    const dust: Dust[] = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.01 + Math.random() * 0.03,
      size: 0.6 + Math.random() * 2.2,
      color: Math.floor(Math.random() * 4),
      wobble: Math.random() * Math.PI * 2,
    }));

    const burst = (strength: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const count = Math.round(70 * strength);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (200 + Math.random() * 700) * strength;
        particles.push({
          x: cx + (Math.random() - 0.5) * w * 0.3,
          y: cy + (Math.random() - 0.5) * h * 0.15,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.5 + Math.random() * 0.9,
          size: 1.5 + Math.random() * 4,
          color: colors[i % colors.length],
        });
      }
      rings.push({ x: cx, y: cy, r: 20, speed: 900 * strength, life: 1, width: 10 * strength, color: colors[0] });
    };

    let lastLine = propsRef.current.lineKey;
    let lastBeat = Number.NaN;
    let wall = 0;
    let prev = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const p = propsRef.current;
      const dt = Math.min(50, now - prev) / 1000;
      prev = now;
      const intensity = (reducedMotion ? 0.3 : 1) * (p.hype ? 1.35 : 1);

      const t = p.getTime();
      const beat = beatAt(p.grid, t);
      const pulse = p.paused ? 0 : beatPulse(beat.frac, 4) * intensity;
      wall += dt * (p.paused ? 0.2 : 1);

      // Paletwissel bij een nieuw nummer soepel laten overvloeien.
      const k = 1 - Math.exp(-dt * 2.5);
      colors = colors.map((c, i) => lerpHsl(c, p.palette.colors[i % p.palette.colors.length], k));
      base = lerpHsl(base, p.palette.base, k);

      // --- blobs ---
      const bw = blobCanvas.width;
      const bh = blobCanvas.height;
      bctx.globalCompositeOperation = 'source-over';
      bctx.fillStyle = hsl(base);
      bctx.fillRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < BLOBS; i++) {
        const c = colors[i % colors.length];
        const cx = bw * (0.5 + 0.4 * Math.sin(wall * 0.13 * (i + 1) + i * 1.7));
        const cy = bh * (0.5 + 0.4 * Math.cos(wall * 0.1 * (i + 2) + i));
        const r = Math.max(bw, bh) * (0.32 + 0.06 * Math.sin(wall * 0.5 + i)) * (1 + pulse * 0.22);
        const g = bctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, hsl(c, 0.75 + pulse * 0.25));
        g.addColorStop(0.55, hsl(c, 0.25));
        g.addColorStop(1, hsl(c, 0));
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, bw, bh);
      }

      // --- effecten ---
      if (p.lineKey !== lastLine) {
        lastLine = p.lineKey;
        if (p.lineKey >= 0) burst(intensity * (p.hype ? 1.2 : 0.8));
      }
      if (!p.paused && beat.index !== lastBeat) {
        if (!Number.isNaN(lastBeat) && p.grid.confidence > 0.15) {
          const downbeat = beat.index % 4 === 0;
          rings.push({
            x: w / 2,
            y: h / 2,
            r: Math.min(w, h) * 0.12,
            speed: downbeat ? 700 : 450,
            life: downbeat ? 0.55 * intensity : 0.25 * intensity,
            width: downbeat ? 6 : 3,
            color: colors[(beat.index & 3) % colors.length],
          });
        }
        lastBeat = beat.index;
      }

      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, w, h);
      fctx.globalCompositeOperation = 'lighter';

      for (const d of dust) {
        d.y -= d.speed * dt * (1 + pulse * 4);
        d.wobble += dt;
        if (d.y < -0.05) {
          d.y = 1.05;
          d.x = Math.random();
        }
        const x = (d.x + Math.sin(d.wobble) * 0.01) * w;
        fctx.fillStyle = hsl(colors[d.color], 0.45 + pulse * 0.4);
        fctx.beginPath();
        fctx.arc(x, d.y * h, d.size * (1 + pulse * 0.8), 0, Math.PI * 2);
        fctx.fill();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.vx *= 1 - 2.2 * dt;
        q.vy = q.vy * (1 - 2.2 * dt) + 120 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.life -= q.decay * dt;
        if (q.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        fctx.fillStyle = hsl(q.color, q.life);
        fctx.beginPath();
        fctx.arc(q.x, q.y, q.size * (0.5 + q.life), 0, Math.PI * 2);
        fctx.fill();
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r += ring.speed * dt;
        ring.life -= dt * 1.4;
        if (ring.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        fctx.strokeStyle = hsl(ring.color, ring.life);
        fctx.lineWidth = ring.width * ring.life;
        fctx.beginPath();
        fctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        fctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="bg" aria-hidden>
      <canvas ref={blobRef} className="bg-blobs" />
      <canvas ref={fxRef} className="bg-fx" />
      <div className="bg-vignette" />
    </div>
  );
}
