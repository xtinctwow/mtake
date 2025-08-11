import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import { startPriceUpdater } from "./cron/updatePrices";
import diceRoutes from "./routes/dice";

dotenv.config();

const app = express();

app.set('trust proxy', true);

app.use(compression());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from IP: ${req.ip} / Origin: ${req.headers.origin}`);
  next();
});

app.use(cors({
  origin: ['https://cyebe.com', 'https://www.cyebe.com'],
  credentials: true,
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from ${req.headers.origin}`);
  next();
});

app.options("*", cors());

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/dice", diceRoutes);

startPriceUpdater();

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
