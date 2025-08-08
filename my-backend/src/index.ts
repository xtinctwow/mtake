import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression"; // ✅ Dodaj compress
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import { startPriceUpdater } from "./cron/updatePrices";

dotenv.config();

const app = express();

// ✅ Compression za vse response (zmanjša velikost)
app.use(compression());

// ✅ CORS – pravilno nastavljeno za tvojo domeno
app.use(cors({
  origin: ['https://cyebe.com', 'https://www.cyebe.com'],
  credentials: true,
}));

// ✅ JSON parser
app.use(express.json());

// ✅ Debug logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from ${req.headers.origin}`);
  next();
});

// ✅ Preflight CORS za vse metode
app.options("*", cors());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

// ✅ Cron job
startPriceUpdater();

// ✅ Start server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
