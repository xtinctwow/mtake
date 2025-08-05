import axios from "axios";

export const generateCryptoAddress = async (currency: string, userId: number): Promise<string> => {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY is not set in environment variables");

  const orderId = `user-${userId}-${currency.toLowerCase()}-deposit`;

  try {
    const response = await axios.post(
      "https://api.nowpayments.io/v1/payment",
      {
        order_id: orderId,
        price_amount: 0.0001,
        price_currency: currency.toLowerCase(),
        pay_currency: currency.toLowerCase(),
        ipn_callback_url: "https://yourdomain.com/api/wallet/ipn"
      },
      {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    const payAddress = response.data.pay_address;
    if (!payAddress) throw new Error("Failed to get pay_address from NOWPayments response");
    return payAddress;
  } catch (err: any) {
    console.error("NOWPayments API error:", err?.response?.data || err.message);
    throw new Error("Failed to generate crypto address via NOWPayments");
  }
};
