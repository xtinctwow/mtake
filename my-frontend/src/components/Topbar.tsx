import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaDice, FaWallet, FaUserShield, FaCrown, FaUsers, FaChartBar,
  FaExchangeAlt, FaClipboardList, FaCog, FaLightbulb, FaHeadset,
  FaSignOutAlt, FaBell, FaUserCircle, FaSearch
} from "react-icons/fa";

export default function Topbar({
  balance,
  onWalletClick,
}: {
  balance: string;
  onWalletClick: () => void;
}) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current && !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        notificationsRef.current && !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex justify-between items-center bg-gray-800 px-6 py-3 text-white relative z-50">
      {/* LEFT - LOGO */}
      <Link to="/" className="flex items-center text-2xl font-bold z-10 space-x-2">
        <FaDice className="text-lg mr-2" />CYEBE
      </Link>

      {/* CENTER - BALANCE & WALLET (only if logged in) */}
      {isAuthenticated && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4">
          <div className="font-mono bg-gray-700 rounded px-3 py-1">{balance} BTC</div>
          <button
            onClick={onWalletClick}
            className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-1 text-white"
          >
            Wallet
          </button>
        </div>
      )}

      {/* RIGHT - AUTH / ICONS */}
      <div className="flex items-center space-x-4 z-10">
        {!isAuthenticated ? (
          <>
            <Link
              to="/login"
              className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-1"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-1"
            >
              Register
            </Link>
          </>
        ) : (
          <>
            {/* Search Icon */}
            <button title="Search" className="flex items-center justify-center text-xl leading-none hover:text-blue-400">
			  <FaSearch />
			</button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
				  title="Notifications"
				  onClick={() => {
					setShowNotifications(!showNotifications);
					setShowUserMenu(false);
				  }}
				  className="flex items-center justify-center text-xl leading-none hover:text-yellow-400"
				>
				  <FaBell className="align-middle" />
				</button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-black rounded shadow-lg p-4 z-50">
                  <h2 className="text-md font-bold mb-2">🔔 Notifications</h2>
                  <div className="space-y-2 text-sm">
                    <div className="bg-gray-100 p-2 rounded">
                      <div className="font-semibold">🎁 Bonus Received</div>
                      <div className="text-gray-600 text-xs">You received 0.147 BTC to your vault.</div>
                      <div className="text-gray-400 text-xs text-right">12 days ago</div>
                    </div>
                    <div className="bg-gray-100 p-2 rounded">
                      <div className="font-semibold">🌟 VIP Achievement</div>
                      <div className="text-gray-600 text-xs">Bronze VIP unlocked!</div>
                      <div className="text-gray-400 text-xs text-right">12 days ago</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
				  title="User"
				  onClick={() => {
					setShowUserMenu(!showUserMenu);
					setShowNotifications(false);
				  }}
				  className="flex items-center justify-center text-xl leading-none hover:text-blue-400"
				>
				  <FaUserCircle className="align-middle" />
				</button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-black rounded shadow-lg py-2 z-50">
                  {[
                    { icon: <FaWallet />, label: "Wallet" },
                    { icon: <FaUserShield />, label: "Vault" },
                    { icon: <FaCrown />, label: "VIP" },
                    { icon: <FaUsers />, label: "Affiliate" },
                    { icon: <FaChartBar />, label: "Statistics" },
                    { icon: <FaExchangeAlt />, label: "Transactions" },
                    { icon: <FaClipboardList />, label: "My Bets" },
                    { icon: <FaCog />, label: "Settings" },
                    { icon: <FaLightbulb />, label: "Stake Smart" },
                    { icon: <FaHeadset />, label: "Live Support" },
                  ].map(({ icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer space-x-2"
                    >
                      {icon}
                      <span>{label}</span>
                    </div>
                  ))}
                  <div
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer space-x-2 text-red-500"
                  >
                    <FaSignOutAlt />
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
