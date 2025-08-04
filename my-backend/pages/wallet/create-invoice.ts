import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { amount, pay_currency } = req.body;

  if (!amount || !pay_currency) {
    return res.status(400).json({ message: "Missing amount or currency" });
  }

  try {
    const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY!,
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency,
        ipn_callback_url: "https://46.150.54.192:5173/api/wallet/ipn",
        order_description: "Deposit to user wallet",
        is_fixed_rate: true,
      }),
    });

    const data = await invoiceRes.json();
    if (!invoiceRes.ok || !data.invoice_url) {
      console.error("NOWPayments error:", data);
      return res.status(500).json({ message: "Failed to create invoice" });
    }

    return res.status(200).json({ invoice_url: data.invoice_url });
  } catch (err) {
    console.error("Error creating invoice:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
