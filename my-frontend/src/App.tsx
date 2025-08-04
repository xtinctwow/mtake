// src/App.tsx
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import WalletPage from "./components/WalletPage";
import GameCard from "./components/GameCard";
import Registration from "./components/Registration";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const [balance, setBalance] = useState(0.0);
  const { email, token } = useAuth(); // Use token for authentication check

  const isAuthenticated = !!token;

  return (
    <Router>
      <div className="flex bg-gray-900 text-white min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar balance={balance.toFixed(8)} />
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

            <Route
              path="/wallet"
              element={<WalletPage balance={balance} setBalance={setBalance} />}
            />
            <Route path="/register" element={<Registration />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
