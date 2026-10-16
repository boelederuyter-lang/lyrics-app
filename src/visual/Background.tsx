interface Props {
  /** Albumhoes: wordt zwart-wit, donker en wazig op de achtergrond gezet. */
  art: string | null;
  /** Verandert bij elke nieuwe lyric-regel: korte flits. */
  lineKey: number;
}

export function Background({ art, lineKey }: Props) {
  return (
    <div className="bg" aria-hidden>
      {art && <img key={art} className="bg-art" src={art} alt="" />}
      {lineKey >= 0 && <div key={lineKey} className="bg-flash" />}
      <div className="bg-grain" />
      <div className="bg-vignette" />
    </div>
  );
}
