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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 770);
  const [userToggledSidebar, setUserToggledSidebar] = useState(false);

  // Handle screen resize
  useEffect(() => {
  const mediaQuery = window.matchMedia("(max-width: 769px)");

  const handleMediaChange = (e: MediaQueryListEvent) => {
    const shouldCollapse = e.matches;

    setIsSidebarCollapsed(shouldCollapse);
    setUserToggledSidebar(false); // reset manual toggle when screen crosses breakpoint
  };

  // Initial check
  if (!userToggledSidebar) {
    setIsSidebarCollapsed(mediaQuery.matches);
  }

  mediaQuery.addEventListener("change", handleMediaChange);
  return () => mediaQuery.removeEventListener("change", handleMediaChange);
}, [userToggledSidebar]);

  // Collapsed width classes
  const sidebarWidth = isSidebarCollapsed ? "w-20" : "w-64";
  const contentPadding = isSidebarCollapsed ? "pl-20" : "pl-64";
  const topbarLeft = isSidebarCollapsed ? "left-20" : "left-64";

  return (
    <>
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen z-50 transition-all duration-300 ${sidebarWidth}`}>
        <Sidebar
          collapsed={isSidebarCollapsed}
          setCollapsed={(val) => {
            setIsSidebarCollapsed(val);
            setUserToggledSidebar(true); // mark manual override
          }}
        />
      </div>

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
              <main className="p-6 overflow-auto">
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
