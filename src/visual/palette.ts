export interface Palette {
  /** 4 felle kleuren (HSL hue/sat/light) */
  colors: Hsl[];
  /** Donkere achtergrondtint */
  base: Hsl;
}

export type Hsl = [h: number, s: number, l: number];

export const hsl = ([h, s, l]: Hsl, alpha = 1) =>
  `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}% / ${alpha})`;

export const DEFAULT_PALETTE: Palette = {
  colors: [
    [320, 95, 62],
    [265, 90, 64],
    [190, 95, 56],
    [45, 100, 60],
  ],
  base: [265, 55, 6],
};

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Haalt de levendigste kleuren uit een albumhoes en maakt ze extra fel. */
export async function extractPalette(url: string): Promise<Palette> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();

  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const BINS = 24;
  const bins = Array.from({ length: BINS }, () => ({ weight: 0, x: 0, y: 0, s: 0 }));
  let darkHue = 0;
  let darkWeight = 0;
  let darkX = 0;
  let darkY = 0;

  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const rad = (h * Math.PI) / 180;
    if (l < 35 && s > 15) {
      darkWeight += 1;
      darkX += Math.cos(rad);
      darkY += Math.sin(rad);
    }
    if (l < 8 || l > 95 || s < 12) continue;
    const w = (s / 100) ** 2 * (1 - Math.abs(l - 50) / 60) + 0.02;
    const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
    bin.weight += w;
    bin.x += Math.cos(rad) * w;
    bin.y += Math.sin(rad) * w;
    bin.s += s * w;
  }
  if (darkWeight > 0) darkHue = ((Math.atan2(darkY, darkX) * 180) / Math.PI + 360) % 360;

  const ranked = bins
    .filter((b) => b.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((b) => ({ hue: ((Math.atan2(b.y, b.x) * 180) / Math.PI + 360) % 360, sat: b.s / b.weight }));

  const picked: { hue: number; sat: number }[] = [];
  for (const c of ranked) {
    if (picked.every((p) => hueDistance(p.hue, c.hue) >= 35)) picked.push(c);
    if (picked.length === 4) break;
  }
  if (!picked.length) return { ...DEFAULT_PALETTE, base: [darkHue, 30, 6] };

  // Aanvullen met harmonieuze buren zodat er altijd 4 kleuren zijn.
  const shifts = [150, -60, 60, 200];
  for (let i = 0; picked.length < 4; i++) {
    picked.push({ hue: (picked[0].hue + shifts[i] + 360) % 360, sat: picked[0].sat });
  }

  return {
    colors: picked.map((c, i) => [c.hue, Math.max(78, Math.min(100, c.sat + 25)), 58 + (i % 2) * 6] as Hsl),
    base: [darkWeight > 0 ? darkHue : picked[0].hue, 50, 6],
  };
}
