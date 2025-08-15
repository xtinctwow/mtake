import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth(); // ✅ get login method from context
  const navigate = useNavigate(); // ✅ to redirect after login

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://api.cyebe.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
	  login(data.token, data.email, data.username ?? null);
	  
	  if (data.username) {
		localStorage.setItem("username", data.username); // ✅ save username
	  }
	  
	  navigate("/");
	} else {
	  setMessage(data.message || "Login failed");
	}
    } catch {
      setMessage("Error connecting to server");
    }

    setLoading(false);
  }

  return (
    <div className="p-6 text-white flex justify-center">
      <form onSubmit={handleLogin} className="bg-gray-800 p-6 rounded max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded w-full"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {message && <p className="mt-4 text-center text-red-400">{message}</p>}
      </form>
    </div>
  );
}
