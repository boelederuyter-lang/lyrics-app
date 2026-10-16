export type ArtMode = 'color' | 'mono' | 'blur';

export const ART_MODES: { id: ArtMode; label: string }[] = [
  { id: 'color', label: 'Kleur' },
  { id: 'mono', label: 'Z/W' },
  { id: 'blur', label: 'Vaag' },
];

interface Props {
  /** Albumhoes van het nummer. */
  art: string | null;
  /** Verandert bij elke nieuwe lyric-regel: korte flits. */
  lineKey: number;
  /** kleur/z-w: hoes scherp in beeld (wazige versie eromheen); vaag: alleen de wazige versie. */
  mode?: ArtMode;
  /** Er staat tekst over de hoes: dan iets donkerder, zodat de lyrics leesbaar blijven. */
  dim?: boolean;
}

export function Background({ art, lineKey, mode = 'blur', dim = false }: Props) {
  return (
    <div className="bg" data-art={mode} data-dim={dim ? '' : undefined} aria-hidden>
      {art && <img key={`fill-${art}`} className="bg-art" src={art} alt="" />}
      {art && mode !== 'blur' && <img key={`cover-${art}`} className="bg-cover" src={art} alt="" />}
      {lineKey >= 0 && <div key={lineKey} className="bg-flash" />}
      <div className="bg-grain" />
      <div className="bg-vignette" />
    </div>
  );
}
