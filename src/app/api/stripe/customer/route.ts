import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId")?.trim();

    // Verificación de parámetro customerId
    if (!customerId) {
      return NextResponse.json({ error: "Falta el parámetro 'customerId'" }, { status: 400 });
    }

    // Recuperar el cliente para verificar que existe
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
      if ("deleted" in customer && customer.deleted) {
        return NextResponse.json({ error: "Cliente eliminado en Stripe" }, { status: 404 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Cliente no encontrado en Stripe" }, { status: 404 });
    }

    // Obtener suscripciones del cliente
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    // Buscar suscripción con un plan mensual
    const monthlySub = subs.data.find((s) =>
      s.items.data.some(
        (it) => it.price.type === "recurring" && it.price.recurring?.interval === "month"
      )
    );

    if (!monthlySub) {
      return NextResponse.json(
        { error: "No se encontró un plan mensual (solo metered)", status: "none" },
        { status: 404 }
      );
    }

    // Encontrar el item mensual dentro de esa suscripción
    const monthlyItem = monthlySub.items.data.find(
      (it) => it.price.type === "recurring" && it.price.recurring?.interval === "month"
    );

    if (!monthlyItem) {
      return NextResponse.json(
        { error: "La suscripción no tiene un item mensual", status: monthlySub.status },
        { status: 404 }
      );
    }

    // Recuperar nombre del producto de la suscripción
    let productName = "Desconocido";
    if (typeof monthlyItem.price.product === "string") {
      const product = await stripe.products.retrieve(monthlyItem.price.product);
      productName = product.name ?? "Desconocido";
    } else {
      productName = (monthlyItem.price.product as any)?.name ?? "Desconocido";
    }

    // Preparar la respuesta con los datos de la suscripción mensual
    return NextResponse.json({
      plan: productName,
      status: monthlySub.status,
      start_date: monthlySub.start_date ? monthlySub.start_date * 1000 : null,
      end_date: monthlySub.items.data[0].current_period_end
        ? monthlySub.items.data[0].current_period_end * 1000
        : null,
      amount: monthlyItem.price.unit_amount ? monthlyItem.price.unit_amount / 100 : null,
      currency: monthlyItem.price.currency ?? "eur",
      cancel_at_period_end: monthlySub.cancel_at_period_end,
      customerId: customer.id,
      trial_start: monthlySub.trial_start ? monthlySub.trial_start * 1000 : null,
      trial_end: monthlySub.trial_end ? monthlySub.trial_end * 1000 : null,
      raw: monthlySub,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error en /api/stripe/email:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
