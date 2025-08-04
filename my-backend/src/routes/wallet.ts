import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.balance ?? 0 });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

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

// POST /api/wallet/create-invoice
router.post("/create-invoice", authenticateToken, async (req: AuthRequest, res) => {
  const { amount } = req.body;
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  const response = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "x-api-key": apiKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: "usd", // or "btc", etc.
      pay_currency: "btc",
      ipn_callback_url: "https://your-backend.com/api/wallet/ipn", // Add this route too
      order_description: `Deposit for user ${req.userId}`,
    }),
  });

  const data = await response.json();
  res.json(data);
});

// POST /api/wallet/ipn
router.post("/ipn", async (req, res) => {
  const { payment_status, price_amount, order_description } = req.body;
  if (payment_status !== "finished") return res.sendStatus(200); // Only process finished

  const userId = parseInt(order_description.split(" ")[3]); // crude parse

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: price_amount } },
  });

  res.sendStatus(200);
});

export default router;
