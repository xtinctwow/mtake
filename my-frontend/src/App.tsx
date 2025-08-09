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

      {/* Main content */}
      <div className={`bg-gray-900 text-white min-h-screen pt-16 transition-all duration-300 ${contentPadding}`}>
        <Routes>
          <Route
            path="/"
            element={
              <main className="max-w-[1200px] mx-auto p-6 overflow-auto">
                <h2 className="text-2xl font-semibold mb-4">
                  {isAuthenticated ? `Welcome ${email}` : "Welcome to Stake Clone"}
                </h2>

                <section className="mb-8">
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

                <section>
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

      {/* Wallet modal */}
      {showWallet && <WalletModal onClose={() => setShowWallet(false)} />}
    </>
  );
}
