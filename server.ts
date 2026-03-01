import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for ZuckPay Proxy
  app.post("/api/pix", async (req, res) => {
    try {
      const { valor, nome, cpf, produto } = req.body;

      const clientId = process.env.ZUCKPAY_CLIENT_ID;
      const clientSecret = process.env.ZUCKPAY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("Missing ZuckPay credentials");
        return res.status(500).json({ error: "Server misconfiguration: Missing credentials" });
      }

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post("https://zuckpay.com.br/conta/v3/pix/qrcode", {
        valor,
        nome,
        cpf,
        produto
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("ZuckPay API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to generate PIX" });
    }
  });

  // API Route for ZuckPay Proxy (Dev Environment)
  app.post("/api/proxy/zuckpay/qrcode", async (req, res) => {
    try {
      const { valor, nome, cpf, produto } = req.body;

      // In dev, we can read from process.env directly if not using VITE_ prefix, 
      // but since we moved to VITE_ prefix in .env, we should try to read those too.
      // However, process.env in Node might not have VITE_ vars unless loaded.
      // The user provided credentials directly in the frontend code, but for the proxy 
      // to work in dev, we need credentials here too.
      // Let's use the hardcoded credentials provided by the user for now to ensure it works.
      
      const clientId = process.env.VITE_ZUCKPAY_CLIENT_ID || "nobrerich_2200294314";
      const clientSecret = process.env.VITE_ZUCKPAY_CLIENT_SECRET || "3ff4b1ffe2813ef88e3435f66720ba1c24041eba4b0bb2e09a560732b27c226b";

      if (!clientId || !clientSecret) {
        console.error("Missing ZuckPay credentials");
        return res.status(500).json({ error: "Server misconfiguration: Missing credentials" });
      }

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post("https://zuckpay.com.br/conta/v3/pix/qrcode", {
        valor,
        nome,
        cpf,
        produto
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("ZuckPay API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to generate PIX" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed, though usually handled by build)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
