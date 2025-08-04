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

export default router;
