import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/contact", async (req, res) => {
    const { message, email } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El mensaje es obligatorio." });
    }

    // Buscar variables de forma insensible a mayúsculas/minúsculas
    const getEnv = (name: string) => {
      const key = Object.keys(process.env).find(k => k.toUpperCase() === name.toUpperCase());
      return key ? process.env[key] : null;
    };

    const emailUser = getEnv("EMAIL_USER");
    const emailPass = getEnv("EMAIL_PASS");

    if (!emailUser || !emailPass) {
      console.error("Faltan credenciales de email (EMAIL_USER o EMAIL_PASS)");
      return res.status(500).json({ error: "El servidor no está configurado para enviar correos." });
    }

    try {
      const mailOptions = {
        from: emailUser,
        to: "Datalotto49@gmail.com",
        subject: "Nuevo mensaje de contacto - DataLotto49",
        text: `Mensaje: ${message}\n\nEmail del usuario: ${email || "No proporcionado"}`,
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Mensaje enviado correctamente." });
    } catch (error) {
      console.error("Error enviando email:", error);
      res.status(500).json({ error: "Error al enviar el mensaje. Inténtalo de nuevo más tarde." });
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
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
