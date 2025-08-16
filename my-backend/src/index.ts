// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import passport from "passport";
import session from "express-session";

import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import diceRoutes from "./routes/dice";
import minesRoutes from "./routes/mines";
import limboRoutes from "./routes/limbo";
import blackjackRoutes from "./routes/blackjack";
import baccaratRoutes from "./routes/baccarat";
import { authenticateToken } from "./middleware/auth";
import { startPriceUpdater } from "./cron/updatePrices";
import plinkoRouter from "./routes/plinko";

dotenv.config();

const app = express();

app.set("trust proxy", true);
app.use(compression());

// CORS
app.use(
  cors({
    origin: ["https://cyebe.com", "https://www.cyebe.com"],
    credentials: true,
  })
);

// Session — required for OAuth state (LINE, Facebook)
app.use(session({
  name: "oidc",
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,          // only over HTTPS
    httpOnly: true,
    sameSite: "none",
  },
}));

// Passport init (no .session() → we keep JWT stateless auth)
app.use(passport.initialize());

// Parse JSON
app.use(express.json());

// Enable preflight
app.options("*", cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);                    
app.use("/api/dice", authenticateToken, diceRoutes);     
app.use("/api/mines", authenticateToken, minesRoutes);   
app.use("/api/limbo", authenticateToken, limboRoutes);   
app.use("/api/blackjack", authenticateToken, blackjackRoutes); 
app.use("/api/baccarat", authenticateToken, baccaratRoutes); 
app.use("/api/plinko", authenticateToken, plinkoRouter);

// Cron job
startPriceUpdater();

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Start server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
