// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import diceRoutes from "./routes/dice";
import { authenticateToken } from "./middleware/auth";
import { startPriceUpdater } from "./cron/updatePrices";

import minesRoutes from "./routes/mines";
import limboRoutes from "./routes/limbo";

dotenv.config();

const app = express();

app.set("trust proxy", true);
app.use(compression());

// Basic request logging
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url} from IP: ${req.ip} / Origin: ${req.headers.origin}`);
  next();
});

// CORS — allow your web app origins
app.use(
  cors({
    origin: ["https://cyebe.com", "https://www.cyebe.com"],
    credentials: true,
  })
);

// Parse JSON
app.use(express.json());

// (Optional) second logger—kept from your version
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url} from ${req.headers.origin}`);
  next();
});

// Enable preflight
app.options("*", cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);                  // keep as-is (public or protect if you want)
app.use("/api/dice", authenticateToken, diceRoutes);   // 🔒 protect dice endpoints
app.use("/api/mines", authenticateToken, minesRoutes);
app.use("/api/limbo", authenticateToken, limboRoutes);

// Start price updater cron
startPriceUpdater();

// Healthcheck (optional)
app.get("/health", (_req, res) => res.json({ ok: true }));

// Boot
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
