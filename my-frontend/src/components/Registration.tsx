import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Registration() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth(); // ✅ get login method from context
  const navigate = useNavigate(); // ✅ for redirecting

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://api.cyebe.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.email);
        navigate("/");
      } else {
        setMessage(data.message || "Registration failed");
      }
    } catch {
      setMessage("Error connecting to server");
    }

    setLoading(false);
  }

  return (
    <div className="p-6 text-white flex justify-center">
      <form onSubmit={handleRegister} className="bg-gray-800 p-6 rounded max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Register</h2>

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
          {loading ? "Registering..." : "Register"}
        </button>

        {message && <p className="mt-4 text-center text-red-400">{message}</p>}
      </form>
    </div>
  );
}
