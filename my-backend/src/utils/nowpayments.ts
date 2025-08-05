import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function generateCryptoAddress(currency: string, userId: number): Promise<string> {
  const url = "https://api.nowpayments.io/v1/payment";

  const payload = {
    price_amount: 10, // dummy amount
    price_currency: "usd",
    pay_currency: currency,
    ipn_callback_url: "https://yourdomain.com/api/wallet/ipn",
    order_description: `Deposit for user ${userId}`,
  };

  const headers = {
    "x-api-key": process.env.NOWPAYMENTS_API_KEY!,
    "Content-Type": "application/json",
  };

  const response = await axios.post<{ pay_address: string }>(url, payload, { headers });

  return response.data.pay_address;
}
