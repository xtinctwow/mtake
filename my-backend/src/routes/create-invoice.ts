import { Request, Response } from "express";
import fetch from "node-fetch";

const createInvoiceHandler = async (req: Request, res: Response) => {
  const { amount, pay_currency } = req.body;

  if (!amount || !pay_currency) {
    return res.status(400).json({ message: "Missing amount or pay_currency" });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY!;
  const callbackUrl = "https://46.150.54.192:3000/api/wallet/ipn";

  try {
    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency,
        ipn_callback_url: callbackUrl,
        order_description: `Deposit for user ${req.userId}`, // requires middleware to attach userId
        is_fixed_rate: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.invoice_url) {
      console.error("NOWPayments error:", data);
      return res.status(500).json({ message: "Failed to create invoice", error: data });
    }

    return res.json({ invoice_url: data.invoice_url });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default createInvoiceHandler;
