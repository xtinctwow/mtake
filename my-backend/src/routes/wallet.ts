import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

const router = express.Router();
const prisma = new PrismaClient();

// Get balance
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.balance ?? 0 });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Deposit route
router.post("/deposit", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { balance: { increment: amount } },
    });

    res.json({ balance: updated.balance });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Withdraw route
router.post("/withdraw", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.balance < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { balance: { decrement: amount } },
    });

    res.json({ balance: updated.balance });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Create invoice (NOWPayments)
router.post("/create-invoice", authenticateToken, async (req: AuthRequest, res) => {
  const { amount, pay_currency } = req.body;
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!amount || !pay_currency) {
    return res.status(400).json({ message: "Missing amount or currency" });
  }

  try {
    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency,
        ipn_callback_url: "https://46.150.54.192:3000/api/wallet/ipn",
        order_description: `Deposit for user ${req.userId}`,
        is_fixed_rate: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.invoice_url) {
      console.error("NOWPayments error:", data);
      return res.status(500).json({ message: "Failed to create invoice", error: data });
    }

    res.json({ invoice_url: data.invoice_url });
  } catch (err) {
    console.error("Invoice creation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ IPN handler
router.post("/ipn", express.json(), async (req, res) => {
  const { payment_status, price_amount, order_description } = req.body;
  const hmacHeader = req.headers["x-nowpayments-sig"] as string;
  const secret = process.env.NOWPAYMENTS_API_KEY;

  const payload = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac("sha512", secret!).update(payload).digest("hex");

  if (hmacHeader !== expectedSig) {
    console.warn("Invalid IPN signature");
    return res.sendStatus(403);
  }

  console.log("✅ Valid IPN received:", req.body);

  if (payment_status !== "finished") return res.sendStatus(200);

  const match = order_description?.match(/user (\d+)/);
  const userId = match ? parseInt(match[1]) : null;
  const amount = parseFloat(price_amount);

  if (!userId || isNaN(amount)) {
    console.error("Invalid IPN payload: userId or amount missing");
    return res.sendStatus(400);
  }

  try {
    await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: "deposit",
        status: "confirmed",
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    await prisma.btcWallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    });


// ✅ Get BTC wallet info
router.get("/btc", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const wallet = await prisma.btcWallet.findUnique({
      where: { userId: req.userId },
    });

    if (!wallet) return res.status(404).json({ message: "BTC Wallet not found" });

    res.json({ address: wallet.address, balance: wallet.balance });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
    res.sendStatus(200);
  } catch (err) {
    console.error("DB error handling IPN:", err);
    res.sendStatus(500);
  }
});

export default router;
