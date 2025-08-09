import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import {
  FaDice, FaWallet, FaUserShield, FaCrown, FaUsers, FaChartBar,
  FaExchangeAlt, FaClipboardList, FaCog, FaLightbulb, FaHeadset,
  FaSignOutAlt, FaBell, FaUserCircle, FaSearch
} from "react-icons/fa";
import logo from "../assets/cyebe-logo-web.png";

export default function Topbar({
  balance,
  onWalletClick,
}: {
  balance: string;
  onWalletClick: () => void;
}) {
  const { isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  
  const api = import.meta.env.VITE_API_URL;
  
	const [btcBalance, setBtcBalance] = useState(0);
	const [solBalance, setSolBalance] = useState(0);
	const [btcPrice, setBtcPrice] = useState(68000);
	const [solPrice, setSolPrice] = useState(150);
	const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);

	useEffect(() => {
	  const fetchBalances = async () => {
		if (!isAuthenticated || !token) return;

		try {
		  const [btcRes, solRes, pricesRes] = await Promise.all([
			fetch(`${api}/api/wallet/btc`, { headers: { Authorization: `Bearer ${token}` } }),
			fetch(`${api}/api/wallet/sol`, { headers: { Authorization: `Bearer ${token}` } }),
			fetch(`${api}/api/wallet/prices`),
		  ]);

		  let btc = 0;
		  let sol = 0;

		  if (btcRes.ok) {
			const data = await btcRes.json();
			btc = data.balance || 0;
			setBtcBalance(btc);
		  }

		  if (solRes.ok) {
			const data = await solRes.json();
			sol = data.balance || 0;
			setSolBalance(sol);
		  }

		  if (pricesRes.ok) {
			const data = await pricesRes.json();
			if (data.BTC) setBtcPrice(data.BTC);
			if (data.SOL) setSolPrice(data.SOL);
		  }

		  if (btc <= 0 && sol <= 0) {
			setSelectedCurrency("BTC");
			localStorage.setItem("selectedCurrency", "BTC");
		  }

		} catch (error) {
		  console.error("Error fetching balances:", error);
		}
	  };

	  fetchBalances();
	}, [token, isAuthenticated]);
	
	const balanceDropdownRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
	  const handleClickOutside = (event: MouseEvent) => {
		if (
		  balanceDropdownRef.current &&
		  !balanceDropdownRef.current.contains(event.target as Node)
		) {
		  setShowBalanceDropdown(false);
		}
	  };
	  document.addEventListener("mousedown", handleClickOutside);
	  return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

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
  <header className="bg-gray-800 text-white relative z-50 boxshadow">
    <div className="max-w-[1200px] mx-auto justify-between items-center">
    <header className="flex justify-between items-center bg-gray-800 px-6 py-3 text-white relative z-50">
      {/* LEFT - LOGO */}
      <Link to="/" className="flex items-center text-2xl font-bold z-10 space-x-2">
        <img
    src={logo}
    alt="CYEBE Logo"
    className="h-auto w-auto mr-2"
  />
      </Link>

      {/* CENTER - BALANCE & WALLET (only if logged in) */}
      {isAuthenticated && (
		  <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4" ref={balanceDropdownRef}>
			{/* Balance Dropdown */}
			<div className="relative">
			  <button
				onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
				className="font-mono bg-gray-700 hover:bg-gray-600 rounded px-3 py-1"
			  >
				{selectedCurrency === "BTC" && `${btcBalance.toFixed(8)} BTC`}
				{selectedCurrency === "SOL" && `${solBalance.toFixed(8)} SOL`}
			  </button>
			  {showBalanceDropdown && (
				<div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-white text-black rounded shadow-lg p-4 z-50">
				  <h2 className="text-sm font-semibold text-gray-700 mb-2">Your Balances</h2>
				  <div className="space-y-2 text-sm">
					{btcBalance > 0 && (
					  <div
						className="flex justify-between items-center hover:bg-gray-200 px-2 py-1 rounded cursor-pointer"
						onClick={() => {
						  setSelectedCurrency("BTC");
						  setShowBalanceDropdown(false);
						}}
					  >
						<div className="flex gap-2 items-center">
						  <img src="https://s2.coinmarketcap.com/static/img/coins/32x32/1.png" alt="BTC" className="w-5 h-5" />
						  <span>BTC</span>
						</div>
						<div className="text-right">
						  <div className="font-mono">{btcBalance.toFixed(8)}</div>
						  <div className="text-xs text-gray-500">${(btcBalance * btcPrice).toFixed(2)} USDT</div>
						</div>
					  </div>
					)}
					
					{solBalance > 0 && (
					  <div
						className="flex justify-between items-center hover:bg-gray-200 px-2 py-1 rounded cursor-pointer"
						onClick={() => {
						  setSelectedCurrency("SOL");
						  setShowBalanceDropdown(false);
						}}
					  >
						<div className="flex gap-2 items-center">
						  <img src="https://s2.coinmarketcap.com/static/img/coins/32x32/5426.png" alt="SOL" className="w-5 h-5" />
						  <span>SOL</span>
						</div>
						<div className="text-right">
						  <div className="font-mono">{solBalance.toFixed(8)}</div>
						  <div className="text-xs text-gray-500">${(solBalance * solPrice).toFixed(2)} USDT</div>
						</div>
					  </div>
					)}
					
					{btcBalance <= 0 && solBalance <= 0 && (
					  <div className="flex flex-col items-center text-center text-gray-500 space-y-2">
						<img
						  src="https://s2.coinmarketcap.com/static/cloud/img/loyalty-program/diamond-icon.svg"
						  alt="Empty"
						  className="w-8 h-8 mx-auto"
						/>
						<div>Your wallet is empty.</div>
						<button
						  onClick={() => {
							setShowBalanceDropdown(false);
							onWalletClick();
						  }}
						  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
						>
						  Wallet
						</button>
					  </div>
					)}
				  </div>
				</div>
			  )}
			</div>

			{/* Wallet Button */}
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
	</div>
  </header>
  );
}
