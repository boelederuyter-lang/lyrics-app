import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

// Lyrics moeten altijd binnen het scherm blijven, hoe lang een woord of regel ook is.
// We meten de echte tekst (met het echte font) en verkleinen tot alles past.

/** Wat ruimte overhouden voor de beat-bump. */
const WIDTH_MARGIN = 0.96;
const HEIGHT_MARGIN = 0.94;
/** Afstand tot de schermrand die een inslaand woord vrijlaat. */
const EDGE_PX = 6;

/** Beschikbare ruimte: het inhoudsvak van het podium (.stage) waar de tekst in staat. */
function availableBox(el: HTMLElement): { width: number; height: number } {
  const stage = el.closest<HTMLElement>('.stage');
  if (!stage) return { width: window.innerWidth, height: window.innerHeight };
  const cs = getComputedStyle(stage);
  return {
    width: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    height: stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
  };
}

/** Past het: geen woord breder dan het podium, en het blok niet hoger? */
function fits(el: HTMLElement, words: string, box: { width: number; height: number }): boolean {
  let widest = 0;
  el.querySelectorAll<HTMLElement>(words).forEach((w) => {
    widest = Math.max(widest, w.offsetWidth);
  });
  return widest <= box.width * WIDTH_MARGIN && el.scrollHeight <= box.height * HEIGHT_MARGIN;
}

/**
 * Hoeveel mag elk woord uitvergroot "inslaan" zonder de schermrand te raken? Zet `--slam` per woord
 * (maximaal `slam`). Lange woorden aan de rand slaan dus wat minder hard in.
 */
function setSlamRoom(el: HTMLElement, words: string, slam: number) {
  const right = window.innerWidth - EDGE_PX;
  el.querySelectorAll<HTMLElement>(words).forEach((w) => {
    // offsetWidth is de breedte zonder animatie; het midden blijft staan bij het schalen.
    const r = w.getBoundingClientRect();
    const half = w.offsetWidth / 2;
    const center = r.left + r.width / 2;
    const side = Math.max(0, Math.min(center - half - EDGE_PX, right - (center + half)));
    const room = 1 + side / Math.max(1, half);
    w.style.setProperty('--slam', Math.max(1, Math.min(slam, room)).toFixed(3));
  });
}

/**
 * Zet de lettergrootte van `ref` op de grootste waarde ≤ `maxPx` waarbij alles past.
 * `words` selecteert de woorden (een woord kan niet afgebroken worden, dus die moeten passen).
 * Woorden met een eigen grootte in `em` schalen mee. Met `slam` krijgt elk woord ook `--slam`.
 */
export function useFitText(
  ref: RefObject<HTMLElement | null>,
  maxPx: number,
  words: string,
  { slam = 0, minPx = 14 }: { slam?: number; minPx?: number } = {},
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const box = availableBox(el);
      const apply = (px: number) => {
        el.style.fontSize = `${px}px`;
      };
      apply(maxPx);
      if (!fits(el, words, box)) {
        let lo = minPx;
        let hi = maxPx;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          apply(mid);
          if (fits(el, words, box)) lo = mid;
          else hi = mid;
        }
        apply(Math.floor(lo));
      }
      if (slam) setSlamRoom(el, words, slam);
    };

    fit();
    // Font (Anton) nog niet binnen bij de eerste meting? Dan opnieuw meten zodra hij er is.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    window.addEventListener('resize', fit);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fit);
    };
  }, [ref, maxPx, words, slam, minPx]);
}

/** Schermgrootte, zodat de maximale lettergrootte meeverandert bij draaien van je telefoon. */
export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** Hetzelfde font als `--display` in de CSS. */
export const DISPLAY_FONT = "Anton, Impact, 'Arial Narrow', sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;

/** Breedte van `text` op 100px in `font`, via canvas (zonder de pagina opnieuw op te bouwen). */
export function textWidthAt100(text: string, font = DISPLAY_FONT): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 50;
  measureCtx.font = `100px ${font}`;
  return measureCtx.measureText(text).width;
}

/** Wordt true zodra de webfonts geladen zijn (dan kloppen metingen pas echt). */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.status === 'loaded');
  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return ready;
}
