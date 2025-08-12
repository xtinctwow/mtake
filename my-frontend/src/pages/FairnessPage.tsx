import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function FairnessPage() {
  const [searchParams] = useSearchParams();

  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState<number>(1);
  const [roll, setRoll] = useState<number | null>(null);
  const [serverSeedHash, setServerSeedHash] = useState("");

  // Load from URL on mount
  useEffect(() => {
    const s = searchParams.get("serverSeed");
    const c = searchParams.get("clientSeed");
    const n = searchParams.get("nonce");

    if (s) setServerSeed(s);
    if (c) setClientSeed(c);
    if (n) setNonce(Number(n));
  }, [searchParams]);

  async function verifyWithServer() {
    try {
      const r = await fetch(
        `/api/dice/verify?serverSeed=${encodeURIComponent(serverSeed)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${encodeURIComponent(
          nonce
        )}`
      ).then((res) => res.json());

      setServerSeedHash(r.serverSeedHash);
      setRoll(r.roll);
    } catch (err) {
      console.error("Verify failed", err);
    }
  }

  async function verifyLocally() {
    try {
      const res = await fetch("/api/dice/verify-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverSeed, clientSeed, nonce }),
      }).then((res) => res.json());

      setServerSeedHash(res.serverSeedHash);
      setRoll(res.roll);
    } catch (err) {
      console.error("Local verify failed", err);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto text-white">
      <h1 className="text-2xl mb-4">Fairness Verification</h1>

      <div className="space-y-4">
        <div>
          <label className="block">Server Seed (hex)</label>
          <input
            value={serverSeed}
            onChange={(e) => setServerSeed(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
          />
        </div>

        <div>
          <label className="block">Client Seed</label>
          <input
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
          />
        </div>

        <div>
          <label className="block">Nonce</label>
          <input
            type="number"
            value={nonce}
            onChange={(e) => setNonce(Number(e.target.value))}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={verifyWithServer}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Verify with Server
          </button>
          <button
            onClick={verifyLocally}
            className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
          >
            Verify Locally
          </button>
        </div>

        {serverSeedHash && (
          <div className="mt-4">
            <p>
              <strong>Server Seed Hash:</strong> {serverSeedHash}
            </p>
            <p>
              <strong>Roll:</strong> {roll !== null ? roll.toFixed(2) : "N/A"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
