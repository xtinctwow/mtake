// src/components/Topbar.tsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import {
  FaWallet, FaUserShield, FaCrown, FaUsers, FaChartBar,
  FaExchangeAlt, FaClipboardList, FaCog, FaLightbulb, FaHeadset,
  FaSignOutAlt, FaBell, FaUserCircle, FaSearch
} from "react-icons/fa";
import logo from "../assets/cyebe-logo-web.png";
import { usePrices } from "../context/PricesContext";

type Cur = "BTC" | "SOL";

/* --- Tiny easing + rAF number tween --- */
function useAnimatedNumber(target: number, duration = 400) {
  const [value, setValue] = useState<number>(target);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const from = value;
    const delta = target - from;
    if (!isFinite(delta) || duration <= 0) {
      setValue(target);
      return;
    }
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setValue(from + delta * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

function BalanceTicker({ value, currency }: { value: number; currency: Cur }) {
  const anim = useAnimatedNumber(value, 400);
  return (
    <span className="cyere-num">
      {anim.toFixed(8)} {currency}
    </span>
  );
}

export default function Topbar({
  onWalletClick,
}: {
  onWalletClick: () => void;
}) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const {
    selectedCurrency,
    setSelectedCurrency,
    btcBalance,
    solBalance,
  } = useCurrency();

  const { BTC: btcPrice = 0, SOL: solPrice = 0 } = usePrices();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const balanceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(t)) setShowUserMenu(false);
      if (notificationsRef.current && !notificationsRef.current.contains(t)) setShowNotifications(false);
      if (balanceDropdownRef.current && !balanceDropdownRef.current.contains(t)) setShowBalanceDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); navigate("/"); };

  // za prikaz v gumbu zraven Wallet
  const shownCurrency = selectedCurrency as Cur;
  const shownBalance = shownCurrency === "BTC" ? btcBalance : solBalance;

  return (
    <header className="topbarbg text-white relative z-50 boxshadow">
      <div className="max-w-[1200px] mx-auto h-16 justify-between items-center">
        <header className="flex h-16 justify-between items-center px-6 py-4 text-white relative z-50">
          {/* LEFT - LOGO */}
          <Link to="/" className="flex items-center text-2xl font-bold z-10 space-x-2">
            <img src={logo} alt="CYEBE Logo" className="h-auto w-auto mr-2" />
          </Link>

          {/* CENTER - BALANCE & WALLET */}
          {isAuthenticated && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4" ref={balanceDropdownRef}>
              {/* Balance Dropdown trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                  className="bg-gray-700 hover:bg-gray-600 rounded px-3 py-1"
                >
                  {/* reset animacije, ko menjaš valuto */}
                  <BalanceTicker key={shownCurrency} value={shownBalance} currency={shownCurrency} />
                </button>

                {showBalanceDropdown && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-white text-black rounded shadow-lg p-4 z-50">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Your Balances</h2>
                    <div className="space-y-3 text-sm">
                      {/* BTC row */}
                      <div
                        className="rounded p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => { setSelectedCurrency("BTC"); setShowBalanceDropdown(false); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2 items-center">
                            <img src="https://s2.coinmarketcap.com/static/img/coins/32x32/1.png" alt="BTC" className="w-5 h-5" />
                            <span className="font-medium">BTC</span>
                          </div>
                          <div className="text-right">{btcBalance.toFixed(8)}</div>
                        </div>
                        <div className="text-right mt-1 text-xs text-gray-500">
                          ${(btcBalance * btcPrice).toFixed(2)} USDT
                        </div>
                      </div>

                      {/* SOL row */}
                      <div
                        className="rounded p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => { setSelectedCurrency("SOL"); setShowBalanceDropdown(false); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2 items-center">
                            <img src="https://s2.coinmarketcap.com/static/img/coins/32x32/5426.png" alt="SOL" className="w-5 h-5" />
                            <span className="font-medium">SOL</span>
                          </div>
                          <div className="text-right">{solBalance.toFixed(8)}</div>
                        </div>
                        <div className="text-right mt-1 text-xs text-gray-500">
                          ${(solBalance * solPrice).toFixed(2)} USDT
                        </div>
                      </div>
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
                <Link to="/login" className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-3">
                  Login
                </Link>
                <Link to="/register" className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-3">
                  Register
                </Link>
              </>
            ) : (
              <>
                <button title="Search" className="flex items-center justify-center text-xl leading-none hover:text-blue-400 [@media(min-width:1px)_and_(max-width:500px)]:hidden">
                  <FaSearch />
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                  <button
                    title="Notifications"
                    onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
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

                {/* User */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    title="User"
                    onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
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
                        <div key={label} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer space-x-2">
                          {icon}<span>{label}</span>
                        </div>
                      ))}
                      <div
                        onClick={handleLogout}
                        className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer space-x-2 text-red-500"
                      >
                        <FaSignOutAlt /><span>Logout</span>
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
