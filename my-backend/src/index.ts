import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import { startPriceUpdater } from "./cron/updatePrices";

dotenv.config();

const app = express();

// ✅ CORS konfiguracija (za frontend domeni, Cloudflare bo posredoval pravi origin)
const allowedOrigins = [
  "https://cyebe.com",
  "https://www.cyebe.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// ✅ Debug loger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.headers.origin}`);
  next();
});

// ✅ OPTIONS preflight
app.options("*", cors());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

// ✅ Cron job
startPriceUpdater();

// ✅ Start server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
