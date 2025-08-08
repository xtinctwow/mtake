// src/components/WalletPage.tsx
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

export default function WalletPage({
  balance,
  setBalance,
}: {
  balance: number;
  setBalance: (n: number) => void;
}) {
  if (!token) return null;
  const { token } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("btc");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBtcWallet = async () => {
      try {
        const res = await fetch("http://46.150.54.192:3000/api/wallet/btc", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setBalance(data.balance);
          console.log("BTC Address:", data.address);
        }
      } catch (err) {
        console.error("Failed to load BTC wallet", err);
      }
    };

    if (token) fetchBtcWallet();
  }, [token]);

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
        body: JSON.stringify({
          amount: val,
          pay_currency: currency,
        }),
      });

      const data = await res.json();

      if (data && data.invoice_url) {
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
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Wallet</h2>

      <div className="bg-gray-800 p-6 rounded mb-6 max-w-md">
        <p className="mb-2">Current Balance:</p>
        <div className="text-xl font-mono mb-4">{balance.toFixed(8)} BTC</div>

        <input
          type="number"
          placeholder="Amount in USD"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />

        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        >
          <option value="btc">Bitcoin (BTC)</option>
          <option value="eth">Ethereum (ETH)</option>
          <option value="sol">Solana (SOL)</option>
          <option value="bnb">BNB (BSC)</option>
          <option value="trx">Tron (TRX)</option>
        </select>

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded w-full"
        >
          {loading ? "Redirecting..." : "Deposit"}
        </button>
      </div>

      <div className="bg-gray-800 p-6 rounded max-w-md">
        <h3 className="text-lg font-semibold mb-2">Transaction History</h3>
        <p className="text-sm text-gray-400">Coming soon...</p>
      </div>
    </div>
  );
}
