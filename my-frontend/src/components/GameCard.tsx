type GameCardProps = {
  title: string;
  players: number;
  img?: string;
  url?: string; // opcijski prop za povezavo
};

export default function GameCard({ title, players, img, url }: GameCardProps) {
  const content = (
    <div className="items-center cursor-pointer transition max-w-[180px]">
      {img ? (
        <img
          src={img}
          alt={title}
          className="max-w-[180px] h-[236px] mb-2 rounded"
        />
      ) : (
        <div className="rounded w-[180px] h-[236px] flex justify-center items-center text-white font-bold text-lg">
          {title[0]}
        </div>
      )}
      <div className="text-sm text-center max-w-[180px]">{title}<div className="text-xs text-gray-400"> {players.toLocaleString()} playing </div></div>
    </div>
  );

  return url ? (
    <a href={url} rel="noopener noreferrer" className="max-w-[180px]">
      {content}
    </a>
  ) : (
    content
  );
}
