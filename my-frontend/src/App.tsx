// src/App.tsx
import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import WalletPage from "./components/WalletPage";
import GameCard from "./components/GameCard";
import Registration from "./components/Registration";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";
import WalletModal from "./components/WalletModal";
import { Link } from "react-router-dom";
import FacebookButton from "./components/FacebookButton";
import GoogleButton from "./components/GoogleButton";
import LineButton from "./components/LineButton";
import TwitchButton from "./components/TwitchButton";
import VipProgressCard from "./components/VipProgressCard";
import MinesProd from "./games/MinesProd";
import DiceProd from "./games/DiceProd.tsx";
import { useCurrency } from "./context/CurrencyContext";
import LimboPage from "./pages/LimboPage";
import BlackjackPage from "./pages/BlackjackPage";
import AuthErrorModal from "./components/AuthErrorModal";
import BaccaratPage from "./pages/BaccaratPage";

import {
  FaBars, FaGift, FaUsers, FaCrown, FaBook, FaShieldAlt, FaHeadset, FaGlobe,
  FaDice, FaFootballBall, FaChevronDown, FaChevronRight, FaComments
} from "react-icons/fa";
import FairnessPage from "./pages/FairnessPage";

function MinesPage() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const onPlaceBet = (
    bet: number,
    params: { mines: number; currency: "BTC" | "SOL" },
    seeds: { clientSeed: string; nonce: number }
  ) =>
    fetch(`${api}/api/mines/place-bet`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bet,
        mines: params.mines,
        currency: params.currency,            // <- pride iz MinesProd (selectedCurrency)
        seeds: { clientSeed: seeds.clientSeed }
      }),
    }).then(async (r) =>
      r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ message: "place-bet failed" })))
    );

  const onReveal = (roundId: string, index: number) =>
    fetch(`${api}/api/mines/reveal`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roundId, index }),
    }).then(async (r) =>
      r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ message: "reveal failed" })))
    );

  const onCashout = (roundId: string, _safeRevealed: number) =>
    fetch(`${api}/api/mines/cashout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roundId }),
    }).then(async (r) =>
      r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ message: "cashout failed" })))
    );

  return (
    <MinesProd
      onPlaceBet={onPlaceBet}
      onReveal={onReveal}
      onCashout={onCashout}
      minBet={0}      // podpira "free roll"
      maxBet={1000}
      houseEdge={0.01}
    />
  );
}

function Terms() {
  const [terms, setTerms] = useState('');

  useEffect(() => {
    fetch('/terms.txt')
      .then(res => res.text())
      .then(setTerms);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto" style={{ whiteSpace: 'pre-wrap' }}>
      {terms}
    </div>
  );
}

function Privacy() {
  const [privacy, setPrivacy] = useState('');

  useEffect(() => {
    fetch('/privacy.txt')
      .then(res => res.text())
      .then(setPrivacy);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto" style={{ whiteSpace: 'pre-wrap' }}>
      {privacy}
    </div>
  );
}

function AML() {
  const [aml, setAml] = useState('');

  useEffect(() => {
    fetch('/aml.txt')
      .then(res => res.text())
      .then(setAml);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto" style={{ whiteSpace: 'pre-wrap' }}>
      {aml}
    </div>
  );
}

function DiceProdRouteWrapper() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const { selectedCurrency } = useCurrency();

  const onPlaceBet = async (
    bet: number,
    params: { mode: "over" | "under"; chance: number; currency: "BTC" | "SOL" },
    seeds: { clientSeed: string; nonce: number }
  ) => {
    const res = await fetch(`${api}/api/dice/place-bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        bet,
        mode: params.mode,
        chance: params.chance,
        currency: params.currency,
        seeds: { clientSeed: seeds.clientSeed },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "place-bet failed");
    }
    return res.json();
  };

  const onResolve = async (roundId: string) => {
    const res = await fetch(`${api}/api/dice/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ roundId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "resolve failed");
    }
    return res.json();
  };

  return (
    <div className="flex">
      <DiceProd onPlaceBet={onPlaceBet} onResolve={onResolve} />
    </div>
  );
}

export default function App() {
  const [balance, setBalance] = useState(0.0);
  const { login, email, token } = useAuth();
  const [showWallet, setShowWallet] = useState(false);
  const isAuthenticated = !!token;

  const desktopResetQuery = window.matchMedia("(max-width:1200 && min-width: 100%)");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 1200);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => window.innerWidth >= 800);
  const [userToggledSidebar, setUserToggledSidebar] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  
  const api = import.meta.env.VITE_API_URL;
  
  const navigate = useNavigate();

  // Handle screen resize
  useEffect(() => {
  const collapseQuery = window.matchMedia("(max-width: 1299px)");
  const hideQuery = window.matchMedia("(max-width: 799px)");

  const handleResize = () => {
    const shouldCollapse = collapseQuery.matches;
    const shouldHide = hideQuery.matches;

    setIsSidebarVisible(!shouldHide);

    if (!userToggledSidebar) {
      setIsSidebarCollapsed(shouldCollapse);
    }
	
	if (desktopResetQuery.matches && !userToggledSidebar) {
	  setUserToggledSidebar(false);
	}
  };

  handleResize(); // init

  collapseQuery.addEventListener("change", handleResize);
  hideQuery.addEventListener("change", handleResize);

  return () => {
    collapseQuery.removeEventListener("change", handleResize);
    hideQuery.removeEventListener("change", handleResize);
  };
}, [userToggledSidebar]);
	
	const sidebarWidth = !isSidebarVisible ? "w-0" : isSidebarCollapsed ? "w-20" : "w-64";
	const contentPadding = !isSidebarVisible ? "pl-0" : isSidebarCollapsed ? "pl-20" : "pl-64";
	const topbarLeft = !isSidebarVisible ? "left-0" : isSidebarCollapsed ? "left-20" : "left-64";
	
	useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");

    if (token && email && !isAuthenticated) {
      login(token, email);
      navigate("/", { replace: true }); // strip ?token
    }
  }, [isAuthenticated, login, navigate]);
  
	{/*LOGIN ERROR USE EFFECT*/}
  
	useEffect(() => {
	  const params = new URLSearchParams(window.location.search);
	  const err = params.get("auth_error");

	  if (err) {
		let msg = "An unknown error occurred.";

		// LINE
		if (err === "line_no_email") {
		  msg = "LINE login needs an email address. Please grant email permission or use a different login method.";
		} else if (err === "line_auth_failed") {
		  msg = "LINE login failed. Please try again.";

		// Twitch
		} else if (err === "twitch_no_email") {
		  msg = "Twitch login needs an email address. Please verify your email on Twitch or use a different login method.";
		} else if (err === "twitch_auth_failed") {
		  msg = "Twitch login failed. Please try again.";

		// Facebook
		} else if (err === "facebook_app_inactive") {
		  msg = "Facebook login is temporarily unavailable because the app isn’t active. Please try again later or use another login method.";
		} else if (err === "facebook_no_email") {
		  msg = "Facebook didn’t provide an email. Please allow email access on Facebook or use a different login method.";
		} else if (err === "facebook_auth_failed") {
		  msg = "Facebook login failed. Please try again.";
		}

		setAuthErrorMsg(msg);

		// Strip only the auth_error, keep other params
		params.delete("auth_error");
		const next = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
		window.history.replaceState({}, "", next);
	  }
	}, []);

  return (
    <>
      {/* Sidebar */}
      {isSidebarVisible && (
		  <div className={`fixed left-0 top-0 h-screen z-50 transition-all duration-300 ${sidebarWidth}`}>
			<Sidebar
			  collapsed={isSidebarCollapsed}
			  setCollapsed={(val) => {
				setIsSidebarCollapsed(val);
				setUserToggledSidebar(true);
			  }}
			/>
		  </div>
		)}

      {/* Topbar */}
      <div className={`fixed top-0 right-0 h-16 z-40 transition-all duration-300 ${topbarLeft}`}>
        <Topbar
          balance={balance.toFixed(8)}
          onWalletClick={() => setShowWallet(true)}
        />
      </div>
	  
	  {/* OAuthError Message*/}
	  {authErrorMsg && (
		  <AuthErrorModal
			message={authErrorMsg}
			onClose={() => setAuthErrorMsg(null)}
		  />
		)}

      {/* Main content min-h-screen */}
      <div className={`topbarbg text-white pt-16 transition-all duration-300 ${contentPadding}`}>
        <Routes>
          <Route
            path="/"
            element={
              <main className="mainpadding p-6 overflow-auto no-padding">
			  <div className="topheaderbg">
				  {isAuthenticated ? (
					
					
					<>
				 <div className="max-w-[1200px] px-6 mx-auto mb-4 grid md:grid-cols-3 gap-6 py-10 [@media(max-width:767px)]:md:grid-cols-1 [@media(min-width:1px)_and_(max-width:767px)]:justify-center [@media(min-width:1px)_and_(max-width:767px)]:flex [@media(min-width:1px)_and_(max-width:767px)]:text-center">
				  {/* Column 1 */}
				  <div>
					{/*<h2 className="font-bold leading-[120%] text-left text-3xl mybold [@media(min-width:1316px)]:mb-8 [@media(min-width:1300px)]:mb-5 [@media(max-width:1299px)]:mb-5 [@media(max-width:987px)]:mb-0 [@media(min-width:1px)_and_(max-width:767px)]:mb-8 [@media(min-width:1px)_and_(max-width:767px)]:text-center">
					  Welcome<br />{email}
					</h2>*/}
					<div className="flex flex-col justify-center w-full h-full">
					<VipProgressCard
  username={email}
  level="Bronze"
  wager={8420}
  nextLevelTarget={100000}
  isFavorite
/></div>
				  </div>

				   {/* Column 2 */}
  <div className="flex items-center justify-center gradient-border rounded-lg w-full hover:-translate-y-2 transition-transform duration-200 overflow-hidden cimgmain [@media(max-width:767px)]:hidden">
  <a
    href="/casino/home"
    className="flex flex-col w-full bg-gray-900 rounded-md overflow-hidden"
  >
    {/* Image */}
    <div className="w-full overflow-hidden">
      <img
        src="/casino.jpg"
        alt="Casino"
        className="w-full h-[230px] object-cover block"
      />
    </div>

    {/* Text Section */}
    <div className="py-3 px-4 text-left">
      <div className="flex justify-between items-center gap-1.5">
        {/* Left: Shield Icon + Label */}
        <span className="flex items-center font-bold gap-2">
          <FaDice size={16} />
          Casino
        </span>

        {/* Right: Online indicator + Count */}
        <div className="flex items-center gap-1.5">
          <div className="bg-green-400 w-1.5 h-1.5 rounded-full"></div>
          <span className="font-semibold text-sm">48,158</span>
        </div>
      </div>
    </div>
  </a>
</div>

  {/* Column 3 */}
  <div className="flex items-center justify-center gradient-border rounded-lg w-full hover:-translate-y-2 transition-transform duration-200 overflow-hidden cimgmain2 [@media(max-width:767px)]:hidden">
  <a
    href="/sports/home"
    className="flex flex-col w-full bg-gray-900 rounded-md overflow-hidden"
  >
    {/* Image */}
    <div className="w-full overflow-hidden">
      <img
        src="/sports.jpg"
        alt="sports"
        className="w-full h-[230px] object-cover block"
      />
    </div>

    {/* Text Section */}
    <div className="py-3 px-4 text-left">
      <div className="flex justify-between items-center gap-1.5">
        {/* Left: Shield Icon + Label */}
        <span className="flex items-center font-bold gap-2">
          <FaFootballBall size={13} />
          Sports
        </span>

        {/* Right: Online indicator + Count */}
        <div className="flex items-center gap-1.5">
          <div className="bg-green-400 w-1.5 h-1.5 rounded-full"></div>
          <span className="font-semibold text-sm">18,158</span>
        </div>
      </div>
    </div>
  </a>
</div>
				</div>
			</>
					
					
					
					
				  ) : (
				  
				  
				  
				  <>
				 <div className="max-w-[1200px] px-6 mx-auto mb-4 grid md:grid-cols-3 gap-6 py-10 [@media(max-width:767px)]:md:grid-cols-1 [@media(min-width:1px)_and_(max-width:767px)]:justify-center [@media(min-width:1px)_and_(max-width:767px)]:flex [@media(min-width:1px)_and_(max-width:767px)]:text-center">
				  {/* Column 1 */}
				  <div>
					<h2 className="font-bold leading-[120%] text-left text-3xl mybold [@media(min-width:1316px)]:mb-8 [@media(min-width:1300px)]:mb-5 [@media(max-width:1299px)]:mb-5 [@media(max-width:987px)]:mb-0 [@media(min-width:1px)_and_(max-width:767px)]:mb-8 [@media(min-width:1px)_and_(max-width:767px)]:text-center">
					  World's Best Online<br />Casino and Sportsbook
					</h2>
					<Link
					  to="/register"
					  className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-3 inline-block"
					>
					  Register
					</Link>

					<p className="pb-2 pt-0 [@media(min-width:988px)]:pt-7 [@media(min-width:1px)_and_(max-width:767px)]:pt-7">Sign up with:</p>
					<div className="flex gap-1.5 flex-wrap [@media(min-width:1px)_and_(max-width:767px)]:justify-center">
					  <FacebookButton onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/facebook`; }} />
					  <GoogleButton onClick={() => window.location.href = "https://api.cyebe.com/api/auth/google"} />
					  <LineButton onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/line`; }} />
					  <TwitchButton onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/twitch`; }} />
					</div>
				  </div>

				   {/* Column 2 */}
  <div className="flex items-center justify-center gradient-border rounded-lg w-full hover:-translate-y-2 transition-transform duration-200 overflow-hidden cimgmain [@media(max-width:767px)]:hidden">
  <a
    href="/casino/home"
    className="flex flex-col w-full bg-gray-900 rounded-md overflow-hidden"
  >
    {/* Image */}
    <div className="w-full overflow-hidden">
      <img
        src="/casino.jpg"
        alt="Casino"
        className="w-full h-[230px] object-cover block"
      />
    </div>

    {/* Text Section */}
    <div className="py-3 px-4 text-left">
      <div className="flex justify-between items-center gap-1.5">
        {/* Left: Shield Icon + Label */}
        <span className="flex items-center font-bold gap-2">
          <FaDice size={16} />
          Casino
        </span>

        {/* Right: Online indicator + Count */}
        <div className="flex items-center gap-1.5">
          <div className="bg-green-400 w-1.5 h-1.5 rounded-full"></div>
          <span className="font-semibold text-sm">48,158</span>
        </div>
      </div>
    </div>
  </a>
</div>

  {/* Column 3 */}
  <div className="flex items-center justify-center gradient-border rounded-lg w-full hover:-translate-y-2 transition-transform duration-200 overflow-hidden cimgmain2 [@media(max-width:767px)]:hidden">
  <a
    href="/sports/home"
    className="flex flex-col w-full bg-gray-900 rounded-md overflow-hidden"
  >
    {/* Image */}
    <div className="w-full overflow-hidden">
      <img
        src="/sports.jpg"
        alt="sports"
        className="w-full h-[230px] object-cover block"
      />
    </div>

    {/* Text Section */}
    <div className="py-3 px-4 text-left">
      <div className="flex justify-between items-center gap-1.5">
        {/* Left: Shield Icon + Label */}
        <span className="flex items-center font-bold gap-2">
          <FaFootballBall size={13} />
          Sports
        </span>

        {/* Right: Online indicator + Count */}
        <div className="flex items-center gap-1.5">
          <div className="bg-green-400 w-1.5 h-1.5 rounded-full"></div>
          <span className="font-semibold text-sm">18,158</span>
        </div>
      </div>
    </div>
  </a>
</div>
				</div>
			</>
				  )}
			  </div>
                
                <section className="max-w-[1200px] px-6 mx-auto mb-8">
                  <h2 className="text-xl font-semibold mb-4">Continue Playing</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
                    <GameCard title="Dice" players={2902} img="/dice_originals.jpg" url="/casino/games/dice" />
                    <GameCard title="Mines" players={3849} img="/mines_originals.jpg" url="/casino/games/mines" />
                    <GameCard title="Limbo" players={3849} img="/limbo_originals.jpg" url="/casino/games/limbo" />
                    <GameCard title="Blackjack" players={632} img="/bj_originals.jpg" url="/casino/games/blackjack" />
                    <GameCard title="Baccarat" players={632} img="/bacca_originals.jpg" url="/casino/games/baccarat" />
                  </div>
                </section>

                <section className="max-w-[1200px] px-6 mx-auto">
                  <h2 className="text-xl font-semibold mb-4">Trending Games</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
                    <GameCard title="Dice" players={2902} img="/dice_originals.jpg" url="/casino/games/dice" />
                    <GameCard title="Mines" players={3849} img="/mines_originals.jpg" url="/casino/games/mines" />
                    <GameCard title="Limbo" players={3849} img="/limbo_originals.jpg" url="/casino/games/limbo" />
                    <GameCard title="Blackjack" players={632} img="/bj_originals.jpg" url="/casino/games/blackjack" />
                    <GameCard title="Baccarat" players={3456} img="/bacca_originals.jpg" url="/casino/games/baccarat" />
                  </div>
                </section>
              </main>
            }
          />
          <Route path="/wallet" element={<WalletPage balance={balance} setBalance={setBalance} />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
		  <Route path="casino/games/mines" element={<MinesPage />} />
		  <Route path="casino/games/dice" element={<DiceProdRouteWrapper />} />
		  <Route path="casino/games/limbo" element={<LimboPage />} />
		  <Route path="casino/games/blackjack" element={<BlackjackPage />} />
		  <Route path="casino/games/baccarat" element={<BaccaratPage />} />
		  <Route path="/terms" element={<Terms />} />
		  <Route path="/privacy" element={<Privacy />} />
		  <Route path="/anti-money-laundering" element={<AML />} />
		  <Route path="/data-deletion" element={<Privacy />} />
        </Routes>
      </div>
	  
	  {/* Footer min-h-screen */}
	  <div className={`footerbg text-white pt-16 transition-all duration-300 ${contentPadding}`}>
		  
				  <main className="max-w-[1200px] px-6 mx-auto p-6 overflow-auto">
				  <footer className="text-sm pb-6">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6 border-b border-gray-700 pb-8">
              
              {/* Casino */}
              <div>
                <h3 className="font-semibold mb-2">Casino</h3>
                <ul className="space-y-1">
                  <li>Casino Games</li>
                  <li>Slots</li>
                  <li>Live Casino</li>
                  <li>Roulette</li>
                  <li>Blackjack</li>
                  <li>Poker</li>
                  <li>Publishers</li>
                  <li>Promos & Competitions</li>
                  <li>Cyebe Engine</li>
                </ul>
              </div>

              {/* Sports */}
              <div>
                <h3 className="font-semibold mb-2">Sports</h3>
                <ul className="space-y-1">
                  <li>Sportsbook</li>
                  <li>Live Sports</li>
                  <li>Soccer</li>
                  <li>Basketball</li>
                  <li>Tennis</li>
                  <li>eSports</li>
                  <li>Bet Bonuses</li>
                  <li>Sports Rules</li>
                  <li>Racing Rules</li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="font-semibold mb-2">Support</h3>
                <ul className="space-y-1">
                  <li>Help Center</li>
                  <li>Fairness</li>
                  <li>Gambling Helpline</li>
                  <li>Live Support</li>
                  <li>Self Exclusion</li>
                  <li>Law Enforcement Request</li>
                </ul>
              </div>

              {/* About Us */}
              <div>
                <h3 className="font-semibold mb-2">About Us</h3>
                <ul className="space-y-1">
                  <li>VIP Club</li>
                  <li>Affiliate</li>
                  <li><Link to="/privacy">Privacy Policy</Link></li>
                  <li><Link to="/anti-money-laundering">AML Policy</Link></li>
                  <li><Link to="/terms">Terms of Service</Link></li>
                </ul>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="font-semibold mb-2">Payment Info</h3>
                <ul className="space-y-1">
                  <li>Deposit & Withdrawals</li>
                  <li>Currency Guide</li>
                  <li>Crypto Guide</li>
                  <li>Supported Crypto</li>
                  <li>How to Use the Vault</li>
                  <li>How Much to Bet With</li>
                </ul>
              </div>

              {/* FAQ */}
              <div>
                <h3 className="font-semibold mb-2">FAQ</h3>
                <ul className="space-y-1">
                  <li>How-to Guides</li>
                  <li>Online Casino Guide</li>
                  <li>Sports Betting Guide</li>
                  <li>How to Live Stream Sports</li>
                  <li>Cyebe VIP Guide</li>
                  <li>House Edge Guide</li>
                </ul>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="mt-6 text-gray-400 text-xs space-y-3">
              <p>© 2025 Cyebe.com | All Rights Reserved.</p>
              <p>
                Cyebe is owned and operated by CYEBE N.V., registration number: 123456,
                {/*registered address: Seru Loraweg 17 B, Curaçao. Payment agent companies are Medium Rare
                Limited and MRS Tech Limited. Contact us at support@cyebe.com.*/}
              </p>
              <p>
                Cyebe is committed to responsible gambling, for more information visit{" "}
                <a href="https://www.gamblingtherapy.org" className="underline">
                  Gamblingtherapy.org
                </a>
              </p>
              <p className="makeitcenter">1 SOL = $180.18</p>

              {/* Logos */}
              <div className="flex flex-col items-center justify-center">
                <img src="/src/assets/cyebe-logo-web.png" alt="Cyebe Logo" className="makeitcenter" />
				<br/>
                <img src="/src/assets/certgcb.svg" alt="GCB Logo" className="makeitcenter h-10" />
              </div>
            </div>
          </footer>
				  </main>
	  </div>
      {/* Wallet modal */}
      {showWallet && <WalletModal onClose={() => setShowWallet(false)} />}
    </>
  );
}
