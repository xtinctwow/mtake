import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar({ balance }: { balance: string }) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="flex justify-between items-center bg-gray-800 px-6 py-3 text-white">
      <div className="flex items-center space-x-4">
        <div className="font-mono bg-gray-700 rounded px-3 py-1">{balance} BTC</div>
        <Link to="/wallet" className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-1 text-white">Wallet</Link>
      </div>

      <div className="flex items-center space-x-4">
        {!isAuthenticated ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        ) : (
          <button onClick={handleLogout} className="hover:text-red-400">Logout</button>
        )}
        <button title="Search" className="hover:text-blue-400">🔍</button>
        <button title="Notifications" className="hover:text-blue-400">🔔</button>
        <button title="User" className="hover:text-blue-400">👤</button>
      </div>
    </header>
  );
}
