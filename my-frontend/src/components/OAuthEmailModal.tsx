import { useEffect, useRef, useState } from "react";

export default function OAuthEmailModal({
  pendingProvider,
  pendingToken,
  onSubmitSuccess,
  onClose,
}: {
  pendingProvider: "facebook" | "line" | "twitch" | "google";
  pendingToken: string;
  // ✅ allow username to be passed through
  onSubmitSuccess: (token: string, email: string, username?: string | null) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    setError(null);
    const val = email.trim().toLowerCase();
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setError("Please enter a valid email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/auth/complete-oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, email: val }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Could not complete login. Please try again.");
        return;
      }

      // ✅ persist locally
      localStorage.setItem("token", data.token);
      localStorage.setItem("email", data.email);
      if (data.username) {
        localStorage.setItem("username", data.username); // ✅ save username too
      }

      // ✅ bubble up to AuthContext-aware handler
      onSubmitSuccess(data.token, data.email, data.username ?? null);

      // ✅ redirect to homepage
      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div ref={modalRef} className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-white relative">
        <button onClick={onClose} className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl">×</button>
        <div className="mb-4 border-b border-gray-700 pb-3">
          <h3 className="text-lg font-semibold">
            Finish {pendingProvider.charAt(0).toUpperCase() + pendingProvider.slice(1)} Login
          </h3>
        </div>
        <p className="text-sm text-gray-300 mb-4">
          We couldn’t get your email from {pendingProvider}. Please enter your email to complete sign in.
        </p>
        <label className="block text-sm text-gray-300 mb-1">Email</label>
        <input
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 mb-3 outline-none focus:border-gray-500"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 py-2 rounded"
        >
          {loading ? "Submitting..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
