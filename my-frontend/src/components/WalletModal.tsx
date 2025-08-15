import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePrices } from "../context/PricesContext";

export default function WalletModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { BTC: btcPriceRaw, SOL: solPriceRaw } = usePrices();
  const btcPrice = btcPriceRaw ?? 0;
  const solPrice = solPriceRaw ?? 0;

  const [amount, setAmount] = useState("");
  const [tab, setTab] =
    useState<"overview" | "deposit" | "buy" | "settings">("overview");

  const modalRef = useRef<HTMLDivElement>(null);

  const [selectedCurrency, setSelectedCurrency] = useState<"btc" | "sol">("btc");
  const [btcAddress, setBtcAddress] = useState("");
  const [solAddress, setSolAddress] = useState("");
  const [copied, setCopied] = useState(false);

  const [btcBalance, setBtcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);

  const [loading, setLoading] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  const totalValue = btcBalance * btcPrice + solBalance * solPrice;

  // Fetch wallet once when modal opens (and token changes)
  useEffect(() => {
    if (!token) return;

    const ac = new AbortController();
    (async () => {
      try {
        const [btcRes, solRes] = await Promise.all([
          fetch(`${api}/api/wallet/btc`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
          fetch(`${api}/api/wallet/sol`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ac.signal,
          }),
        ]);

        if (btcRes.ok) {
          const data = await btcRes.json();
          setBtcBalance(Number(data.balance || 0));
          if (data.address) setBtcAddress(data.address);
        }
        if (solRes.ok) {
          const data = await solRes.json();
          setSolBalance(Number(data.balance || 0));
          if (data.address) setSolAddress(data.address);
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          console.error("Fetch wallet failed:", e);
        }
      }
    })();

    return () => ac.abort();
  }, [token, api]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleDeposit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${api}/api/wallet/create-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // ✅ use the actual selection
        body: JSON.stringify({ amount: val, pay_currency: selectedCurrency }),
      });
      const data = await res.json();
      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        alert("Failed to create invoice.");
      }
    } catch (err) {
      console.error("Error creating invoice", err);
      alert("An error occurred while creating the invoice.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ease-out animate-fade-in">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-white relative transform transition-all duration-300 scale-100"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-700 pb-2">
          {(["overview", "deposit", "buy", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded ${
                tab === t ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-400">Balance</p>
              <div className="text-3xl font-bold text-white">
                ${totalValue.toFixed(2)} <span className="text-green-400">USDT</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded p-4 mb-6">
              {btcBalance <= 0 && solBalance <= 0 ? (
                <div className="text-center text-white space-y-2">
                  <img
                    src="https://s2.coinmarketcap.com/static/cloud/img/loyalty-program/diamond-icon.svg"
                    alt="Empty Wallet"
                    className="mx-auto w-10 h-10"
                  />
                  <div>Your wallet is empty.</div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="pb-2">Currency</th>
                      <th className="pb-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {btcBalance > 0 && (
                      <tr className="border-t border-gray-700 py-2">
                        <td className="py-2 flex items-center gap-2">
                          <img
                            src="https://s2.coinmarketcap.com/static/img/coins/32x32/1.png"
                            alt="BTC"
                            className="w-5 h-5"
                          />
                          <div>
                            <div className="font-semibold">BTC</div>
                            <div className="text-gray-400 text-xs">Bitcoin</div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div>{btcBalance.toFixed(8)}</div>
                          <div className="text-gray-400 text-xs">
                            ${(btcBalance * btcPrice).toFixed(2)} USDT
                          </div>
                        </td>
                      </tr>
                    )}

                    {solBalance > 0 && (
                      <tr className="border-t border-gray-700 py-2">
                        <td className="py-2 flex items-center gap-2">
                          <img
                            src="https://s2.coinmarketcap.com/static/img/coins/32x32/5426.png"
                            alt="SOL"
                            className="w-5 h-5"
                          />
                          <div>
                            <div className="font-semibold">SOL</div>
                            <div className="text-gray-400 text-xs">Solana</div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div>{solBalance.toFixed(8)}</div>
                          <div className="text-gray-400 text-xs">
                            ${(solBalance * solPrice).toFixed(2)} USDT
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex gap-4 mb-4">
              <button className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded">
                Withdraw
              </button>
              <button
                onClick={() => setTab("deposit")}
                className="w-full bg-green-600 hover:bg-green-500 py-2 rounded"
              >
                Deposit
              </button>
            </div>

            <div className="text-center text-sm text-gray-400 mb-2">
              Improve your account security with Two-Factor Authentication
            </div>
            <button className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded">
              Enable 2FA
            </button>
          </>
        )}

        {/* Deposit */}
        {tab === "deposit" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400">Currency</p>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as "btc" | "sol")}
                className="w-full p-2 rounded bg-gray-800 text-white"
              >
                <option value="btc">BTC (Bitcoin)</option>
                <option value="sol">SOL (Solana)</option>
              </select>
            </div>

            <div>
              <p className="text-sm text-gray-400">Address</p>
              <div className="flex items-center space-x-2 bg-gray-800 rounded px-3 py-2">
                <span className="truncate">
                  {selectedCurrency === "btc"
                    ? btcAddress || "Loading..."
                    : solAddress || "Loading..."}
                </span>
                <button
                  onClick={() => {
                    const address =
                      selectedCurrency === "btc" ? btcAddress : solAddress;
                    if (!address) return;
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard.writeText(address).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    } else {
                      const textArea = document.createElement("textarea");
                      textArea.value = address;
                      textArea.style.position = "fixed";
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      try {
                        document.execCommand("copy");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        alert("Could not copy address");
                      }
                      document.body.removeChild(textArea);
                    }
                  }}
                  className="text-sm text-blue-400 hover:underline"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {selectedCurrency === "btc" && btcAddress && (
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${btcAddress}`}
                  alt="BTC QR Code"
                  className="border border-gray-700 rounded"
                />
              </div>
            )}
            {selectedCurrency === "sol" && solAddress && (
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${solAddress}`}
                  alt="SOL QR Code"
                  className="border border-gray-700 rounded"
                />
              </div>
            )}

            <div className="text-center text-gray-400 text-sm">
              <p>Or deposit directly from your wallet</p>
              <div className="flex justify-center space-x-2 mt-2">
                <span>🦊</span>
                <span>🌐</span>
                <span>🔵</span>
              </div>
              <p className="mt-2">Credited after 1 confirmation</p>
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 outline-none focus:border-gray-500"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-60 px-4 rounded"
              >
                {loading ? "Creating..." : "Create invoice"}
              </button>
            </div>
          </div>
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
