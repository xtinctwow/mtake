import { useEffect, useRef, useState } from "react";

export default function UsernameModal({
  onSuccess,
}: {
  onSuccess: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = import.meta.env.VITE_API_URL;

  // Auto-focus the input when modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    setErr(null);
    const val = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,16}$/.test(val)) {
      setErr("Use 3–16 chars: letters, numbers or underscore.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}/api/auth/set-username`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ username: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.message || "Could not set username.");
        return;
      }
      onSuccess(data.username);
      window.location.href = "/";
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      {/* No global event blockers; no outside click handler; no ESC close */}
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-white relative">
        <div className="mb-4 border-b border-gray-700 pb-3">
          <h3 className="text-lg font-semibold">Choose your username</h3>
        </div>

        <p className="text-sm text-gray-300 mb-4">
          Please pick a unique username to finish setting up your account.
        </p>

        <label className="block text-sm text-gray-300 mb-1">Username</label>
        <input
          ref={inputRef}
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 mb-3 outline-none focus:border-gray-500"
          type="text"
          placeholder="your_name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
          autoComplete="off"
        />

        {err && <div className="text-red-400 text-sm mb-3">{err}</div>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 py-2 rounded"
        >
          {loading ? "Saving..." : "Save username"}
        </button>

        <div className="text-xs text-gray-400 mt-3">
          Allowed: letters (a–z), numbers (0–9), underscore. Length 3–16.
        </div>
      </div>
    </div>
  );
}
