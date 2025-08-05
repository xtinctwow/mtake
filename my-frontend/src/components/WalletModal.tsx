import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function WalletModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("btc");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "buy" | "settings">("overview");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWallet = async () => {
      const res = await fetch("http://46.150.54.192:3000/api/wallet/btc", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    };
    if (token) fetchWallet();
  }, [token]);
  
  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [onClose]);

  const handleDeposit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;

    setLoading(true);
    try {
      const res = await fetch("http://46.150.54.192:3000/api/wallet/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: val, pay_currency: currency }),
      });
      const data = await res.json();
      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        alert("Failed to create invoice.");
      }
    } catch (err) {
      console.error("Error creating invoice", err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ease-out animate-fade-in">
      <div ref={modalRef} className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-white relative transform transition-all duration-300 scale-100">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-semibold mb-4">Wallet</h2>

        <div className="flex space-x-4 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setTab("overview")}
            className={`px-3 py-1 rounded ${tab === "overview" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("buy")}
            className={`px-3 py-1 rounded ${tab === "buy" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
          >
            Buy Crypto
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`px-3 py-1 rounded ${tab === "settings" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
          >
            Settings
          </button>
        </div>

        {tab === "overview" && (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-400">Balance</p>
              <div className="text-xl font-mono">{balance.toFixed(8)} BTC</div>
            </div>

            <div className="mb-6">
              <input
                type="number"
                placeholder="Amount in USD"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white mb-2"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white"
              >
                <option value="btc">BTC</option>
                <option value="eth">ETH</option>
                <option value="sol">SOL</option>
                <option value="usdc">USDC</option>
                <option value="bnb">BNB</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded">Withdraw</button>
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 py-2 rounded"
              >
                {loading ? "Redirecting..." : "Deposit"}
              </button>
            </div>
          </>
        )}

        {tab === "buy" && (
          <div className="text-gray-400 text-sm">
            <p>Feature coming soon: Buy crypto directly inside the wallet!</p>
          </div>
        )}

        {tab === "settings" && (
          <div className="text-gray-400 text-sm">
            <p>2FA, notifications and account limits coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
