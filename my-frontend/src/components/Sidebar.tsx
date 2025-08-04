// src/components/Sidebar.tsx
import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-gray-300 min-h-screen p-6 flex flex-col">
      <div className="mb-8 text-2xl font-bold text-white">
        <Link to="/">Mtake</Link>
      </div>
      <nav className="flex flex-col space-y-4 text-sm">
        <a href="#" className="hover:text-white">Casino</a>
        <a href="#" className="hover:text-white">Sports</a>
        <hr className="my-4 border-gray-700" />
        <a href="#" className="hover:text-white">Promotions</a>
        <a href="#" className="hover:text-white">Affiliate</a>
        <a href="#" className="hover:text-white">VIP Club</a>
        <a href="#" className="hover:text-white">Blog</a>
        <hr className="my-4 border-gray-700" />
        <a href="#" className="hover:text-white">Responsible Gambling</a>
        <a href="#" className="hover:text-white">Live Support</a>
        <a href="#" className="hover:text-white">Language: English</a>
      </nav>
    </aside>
  );
}
