type GameCardProps = {
  title: string;
  players: number;
  img?: string;
  url?: string; // opcijski prop za povezavo
};

export default function GameCard({ title, players, img, url }: GameCardProps) {
  const content = (
    <div className="bg-gray-800 rounded p-4 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition">
      {img ? (
        <img
          src={img}
          alt={title}
          className="w-[180px] h-[236px] mb-2 rounded object-cover"
        />
      ) : (
        <div className="bg-blue-600 rounded w-[180px] h-[236px] mb-2 flex justify-center items-center text-white font-bold text-lg">
          {title[0]}
        </div>
      )}
      <div className="text-sm text-center">{title}</div>
      <div className="text-xs text-gray-400">{players.toLocaleString()} playing</div>
    </div>
  );

  return url ? (
    <a href={url} rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}
