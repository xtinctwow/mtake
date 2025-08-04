// src/components/WalletPage.tsx
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function WalletPage({ balance, setBalance }: { balance: number; setBalance: (n: number) => void }) {
  const [amount, setAmount] = useState("");

  const handleDeposit = () => {
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0) {
      setBalance(balance + val);
      setAmount("");
    }
  };

  const handleWithdraw = () => {
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0 && val <= balance) {
      setBalance(balance - val);
      setAmount("");
    }
  };

  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Wallet</h2>
      <div className="bg-gray-800 p-6 rounded mb-6 max-w-md">
        <p className="mb-2">Current Balance:</p>
        <div className="text-xl font-mono mb-4">{balance.toFixed(8)} BTC</div>

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />
        <div className="flex space-x-4">
          <button onClick={handleDeposit} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
            Deposit
          </button>
          <button onClick={handleWithdraw} className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">
            Withdraw
          </button>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded max-w-md">
        <h3 className="text-lg font-semibold mb-2">Transaction History</h3>
        <p className="text-sm text-gray-400">Coming soon...</p>
      </div>
    </div>
  );
}
