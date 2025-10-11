import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Checkout API endpoint
app.post("/dermascan/subscription-payment", async (req, res) => {
  try {
    const { plan, method, amount } = req.body;

    if (!plan || !method || !amount) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // Convert amount to centavos (PayMongo uses smallest currency unit)
    const amountInCentavos = Math.round(parseFloat(amount) * 100);

    // Normalize the method before validation
    const normalizedMethod = method === "maya" ? "paymaya" : method;

    // Validate supported methods
    const validMethods = ["gcash", "paymaya"];
    if (!validMethods.includes(normalizedMethod)) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported payment method: ${method}`,
      });
    }

    // Create Checkout Session
    const checkoutResponse = await axios.post(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        data: {
          attributes: {
            amount: amountInCentavos,
            currency: "PHP",
            description: `${plan} plan subscription`,
            line_items: [
              {
                name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
                amount: amountInCentavos,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: [normalizedMethod],
            redirect: {
              success: `${BASE_URL}/dermascan/payment-success`,
              failed: `${BASE_URL}/dermascan/payment-failed`,
            },
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );

    const checkoutUrl = checkoutResponse.data.data.attributes.checkout_url;

    return res.json({
      status: "redirect",
      message: "Redirect to complete payment",
      redirect_url: checkoutUrl,
    });
  } catch (error) {
    console.error("PayMongo Checkout API Error:", error.response?.data || error.message);
    return res.status(500).json({
      status: "error",
      message: error.response?.data?.errors?.[0]?.detail || "Checkout session failed",
    });
  }
});

// Simple landing pages
app.get("/dermascan/payment-success", (req, res) => {
  res.send("Payment Success! You can now access premium features.");
});

app.get("/dermascan/payment-failed", (req, res) => {
  res.send("Payment Failed. Please try again.");
});

app.listen(PORT, () => {
  console.log(`Dermascan backend running at http://localhost:${PORT}`);
});
