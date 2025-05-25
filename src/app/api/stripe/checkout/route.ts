import { stripe } from "@/lib/stripe";  // Tu instancia de Stripe
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { quantity, priceId } = await req.json();  // Aquí es donde recibimos el cuerpo de la solicitud

    if (!quantity || !priceId || quantity < 1) {
      return NextResponse.json({ error: "Cantidad o precio inválido" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,  // Usamos el priceId enviado en el cuerpo
          quantity,
        },
      ],
      success_url: process.env.NEXT_PUBLIC_SITE_URL+"/dashboard/success",
      cancel_url: process.env.NEXT_PUBLIC_SITE_URL+"/dashboard/billing",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Error en la creación de la sesión:", err);
    return NextResponse.json({ error: "Fallo al crear sesión de Stripe" }, { status: 500 });
  }
}