// src/components/GameCard.tsx
export default function GameCard({ title, players }: { title: string; players: number }) {
  return (
    <div className="bg-gray-800 rounded p-4 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition">
      <div className="bg-blue-600 rounded w-24 h-24 mb-2 flex justify-center items-center text-white font-bold text-lg">
        {title[0]}
      </div>
      <div className="text-sm text-center">{title}</div>
      <div className="text-xs text-gray-400">{players.toLocaleString()} playing</div>
    </div>
  );
}
