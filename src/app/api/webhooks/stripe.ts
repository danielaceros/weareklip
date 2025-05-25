import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/firebaseAdmin"; // Asegúrate de que esta sea la ruta correcta
import Stripe from "stripe";

// Instancia de Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

// Configuración de Nodemailer para IONOS
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.es',
  port: 465, // o usa 587 si prefieres STARTTLS
  secure: true, // Usa `true` para SSL/TLS en el puerto 465, o `false` para STARTTLS en el puerto 587
  auth: {
    user: process.env.EMAIL_USER, // Tu correo de IONOS
    pass: process.env.EMAIL_PASS, // La contraseña de tu cuenta de IONOS
  },
});

// Función para enviar el correo personalizado
const sendConfirmationEmail = async (customerEmail: string, session: any) => {
  const mailOptions = {
    from: process.env.EMAIL_USER, // Tu correo de IONOS
    to: customerEmail,
    subject: "Confirmación de compra - Pack IA",
    html: `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #fff;
              color: #000;
              margin: 0;
              padding: 0;
            }
            .email-container {
              width: 100%;
              max-width: 600px;
              margin: auto;
              background-color: #000;
              color: #fff;
              padding: 20px;
              border-radius: 10px;
            }
            .email-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .email-header h1 {
              font-size: 32px;
              margin: 0;
            }
            .email-body {
              text-align: left;
              font-size: 16px;
              line-height: 1.6;
            }
            .email-footer {
              margin-top: 30px;
              text-align: center;
              font-size: 14px;
              color: #999;
            }
            .button {
              display: inline-block;
              background-color: #fff;
              color: #000;
              padding: 10px 20px;
              border-radius: 5px;
              text-decoration: none;
              font-weight: bold;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>Gracias por tu compra, ${session.customer_name}!</h1>
              <p>Has adquirido el **Pack de Reels IA** de **KLIP**.</p>
            </div>
            <div class="email-body">
              <p><strong>Detalles de tu compra:</strong></p>
              <ul>
                <li><strong>ID de sesión:</strong> ${session.id}</li>
                <li><strong>Cantidad:</strong> €${(session.amount_total / 100).toFixed(2)}</li>
              </ul>
              <p>¡Esperamos que disfrutes del servicio! Si tienes alguna pregunta, no dudes en ponerte en contacto con nosotros.</p>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button">Ver detalles de la compra</a>
            </div>
            <div class="email-footer">
              <p>&copy; 2025 KLIP | Todos los derechos reservados</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Endpoint para escuchar los webhooks
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  let event: Stripe.Event;

  try {
    // Verifica la firma del webhook
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: unknown) {
    // Si el error es una instancia de Error, se accede a su mensaje
    if (err instanceof Error) {
      console.error("Webhook signature verification failed.", err.message);
    }
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  // Procesar los eventos de Stripe
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Obtener el correo del cliente y la cantidad de productos (reels)
    const customerEmail = session.customer_email;
    const userId = session.client_reference_id; // Aquí tenemos el ID del usuario

    // Obtener la cantidad de productos comprados (puedes personalizar esto si tu estructura es diferente)
    const quantity = session.line_items?.data[0]?.quantity || 0; // Usamos la cantidad del primer item, si existe

    // Obtener el documento de usuario en Firestore para actualizar los créditos
    const userRef = db.collection("users").doc(userId!);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData) {
      // Actualizar los créditos del usuario (puedes personalizar esto según tu modelo de datos)
      const creditsPurchased = quantity;  // Cada reel cuenta como un crédito
      const updatedCredits = (userData.credits || 0) + creditsPurchased;

      await userRef.update({
        credits: updatedCredits,  // Actualiza la cantidad de créditos
      });
      console.log("Créditos actualizados para el usuario:", userId);

      // Enviar correo de confirmación
      if (customerEmail) {
        await sendConfirmationEmail(customerEmail, session);
        console.log('Correo de confirmación enviado a:', customerEmail);
      }
    }
  }

  return NextResponse.json({ received: true });
}
