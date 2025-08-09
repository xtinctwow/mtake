// src/App.tsx
import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
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

export default function App() {
  const [balance, setBalance] = useState(0.0);
  const { email, token } = useAuth();
  const [showWallet, setShowWallet] = useState(false);
  const isAuthenticated = !!token;

  const desktopResetQuery = window.matchMedia("(max-width:800 && min-width: 100%)");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 800);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => window.innerWidth >= 600);
  const [userToggledSidebar, setUserToggledSidebar] = useState(false);

  // Handle screen resize
  useEffect(() => {
  const collapseQuery = window.matchMedia("(max-width: 799px)");
  const hideQuery = window.matchMedia("(max-width: 599px)");

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

      {/* Main content min-h-screen */}
      <div className={`topbarbg text-white pt-16 transition-all duration-300 ${contentPadding}`}>
        <Routes>
          <Route
            path="/"
            element={
              <main className="mainpadding p-6 overflow-auto no-padding">
			  <div className="topheaderbg">
				  {isAuthenticated ? (
					<h2 className="max-w-[1200px] px-6 mx-auto text-2xl mb-4">
					  Welcome {email}
					</h2>
				  ) : (
				  <>
				  <div className="max-w-[1200px] px-6 mx-auto mb-4">
					<h2 className="font-bold leading-[120%] text-left text-3xl py-10 mybold">
					  World's Best Online<br/>Casino and Sportsbook
					</h2>
					<Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-3"
            >
              Register
            </Link>
			<p className="pb-2 pt-10">Sign up with:</p>
			<div className="flex gap-1.5">
			  <FacebookButton onClick={() => console.log("FB clicked")} />
			  <GoogleButton onClick={() => console.log("Google clicked")} />
			  <LineButton onClick={() => console.log("Line clicked")} />
			  <TwitchButton onClick={() => console.log("Twitch clicked")} />
			</div>
			</div>
			</>
				  )}
			  </div>
                
                <section className="max-w-[1200px] px-6 mx-auto mb-8">
                  <h2 className="text-xl font-semibold mb-4">Continue Playing</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    <GameCard title="Roulette" players={632} />
                    <GameCard title="Limbo" players={2676} />
                    <GameCard title="Dice" players={2902} />
                    <GameCard title="Mines" players={3849} />
                    <GameCard title="Dragon Tower" players={892} />
                    <GameCard title="Roulette Live" players={118} />
                    <GameCard title="Wheel" players={401} />
                    <GameCard title="Mega Roulette" players={22} />
                  </div>
                </section>

                <section className="max-w-[1200px] px-6 mx-auto">
                  <h2 className="text-xl font-semibold mb-4">Trending Games</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    <GameCard title="Sweet Bonanza" players={1234} />
                    <GameCard title="The Luxe" players={2345} />
                    <GameCard title="Zombie School" players={3456} />
                    <GameCard title="Super Wildcat" players={4567} />
                    <GameCard title="Brute Force" players={5678} />
                    <GameCard title="Win FXF" players={6789} />
                    <GameCard title="Joker’s Jewels" players={7890} />
                    <GameCard title="Duel A Dawn" players={8901} />
                  </div>
                </section>
              </main>
            }
          />
          <Route path="/wallet" element={<WalletPage balance={balance} setBalance={setBalance} />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
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
                  <li>Stake Engine</li>
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
                  <li>Privacy Policy</li>
                  <li>AML Policy</li>
                  <li>Terms of Service</li>
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
                  <li>Stake VIP Guide</li>
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
