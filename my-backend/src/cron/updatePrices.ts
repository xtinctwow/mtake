import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

const API_KEY = process.env.COINMARKETCAP_API_KEY;

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": API_KEY!,
        },
      }
    );

    const data: any = await response.json();

    const price = data?.data?.[symbol]?.quote?.USD?.price;
    return price ? parseFloat(price.toFixed(2)) : null;
  } catch (error) {
    console.error(`❌ Error fetching ${symbol} price:`, error);
    return null;
  }
}

export function startPriceUpdater() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("⏳ Updating crypto prices...");

    const btc = await fetchPrice("BTC");
    const sol = await fetchPrice("SOL");

    if (btc)
      await prisma.price.upsert({
        where: { symbol: "BTC" },
        update: { usdPrice: btc },
        create: { symbol: "BTC", usdPrice: btc },
      });

    if (sol)
      await prisma.price.upsert({
        where: { symbol: "SOL" },
        update: { usdPrice: sol },
        create: { symbol: "SOL", usdPrice: sol },
      });

    console.log("✅ Prices updated:", { BTC: btc, SOL: sol });
  });
}
