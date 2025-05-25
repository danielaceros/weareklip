import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";

admin.initializeApp();
const db = admin.firestore();

// Cargar configuración SMTP desde variables seguras
const smtpConfig = functions.config().smtp;

const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: 465,
  secure: true,
  auth: {
    user: smtpConfig.email,
    pass: smtpConfig.password,
  },
});

export const notifyDelivery = functions
  .region("us-central1") // ✅ región explícita compatible con Firestore en nam5
  .firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Solo reaccionar si se añadió un deliveredUrl que antes no estaba
    if (!before.deliveredUrl && after.deliveredUrl) {
      const userRef = db.collection("users").doc(after.userId);
      const userSnap = await userRef.get();
      const user = userSnap.data();

      if (!user?.email) return null;

      const mailOptions = {
        from: `"We Are Klip" <${smtpConfig.email}>`,
        to: user.email,
        subject: "🎉 Tu pedido IA ha sido entregado",
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #222;">Hola 👋</h2>
            <p>Tu pedido <strong>${after.title}</strong> ya ha sido entregado.</p>
            <p>Puedes verlo haciendo clic en el siguiente botón:</p>
            <a href="${after.deliveredUrl}" style="display:inline-block; padding:12px 20px; background:#000; color:#fff; text-decoration:none; border-radius:5px; font-weight:bold;">
              Ver entrega
            </a>
            <p style="margin-top: 20px;">Gracias por usar <strong>We Are Klip</strong> 💡</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📬 Correo enviado a ${user.email}`);
    }

    return null;
  });
