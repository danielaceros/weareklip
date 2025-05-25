import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Configuración de Nodemailer para IONOS
const transporter = nodemailer.createTransport({
  host: "smtp.ionos.com", // Host SMTP de IONOS
  port: 465, // Puerto seguro
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Tu correo de IONOS
    pass: process.env.EMAIL_PASS, // Tu contraseña de IONOS
  },
});

export async function POST(req: NextRequest) {
  try {
    const { quantity, priceId, email, userId } = await req.json();  // Recibimos la cantidad, el precio y el ID del usuario

    if (!quantity || !priceId || quantity < 1 || !email || !userId) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Crear la sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/success?userId=${userId}&quantity=${quantity}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
      customer_email: email, // Correo del cliente
      client_reference_id: userId,
    });

    // Enviar el correo al cliente
    const mailOptions = {
      from: `"We Are Klip" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Pedido recibido - ¡Gracias por tu compra!",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #222;">¡Gracias por tu compra!</h2>
          <p>Hemos recibido tu pedido de <strong>${quantity} reel${quantity > 1 ? "s" : ""}</strong>.</p>
          <p>El total es: <strong>${15 * quantity}€</strong></p>
          <p>Puedes ver y gestionar tu pedido en el siguiente enlace:</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="display:inline-block; padding:12px 20px; background:#000; color:#fff; text-decoration:none; border-radius:5px; font-weight:bold;">
            Ver pedido
          </a>
          <p>Te mantendremos informado sobre el progreso de tu pedido.</p>
          <p>¡Gracias por elegir We Are Klip!</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Error en la creación de la sesión:", err);
    return NextResponse.json({ error: "Fallo al crear sesión de Stripe" }, { status: 500 });
  }
}
