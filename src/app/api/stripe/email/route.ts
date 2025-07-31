import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")?.toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ error: "Falta el parámetro 'email'" }, { status: 400 })
    }

    // Buscar cliente en Stripe
    const customers = await stripe.customers.list({ email, limit: 1 })

    if (!customers.data.length) {
      return NextResponse.json({ error: "Cliente no encontrado en Stripe" }, { status: 404 })
    }

    const customer = customers.data[0]

    // Obtener suscripciones del cliente
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 5,
    })

    const activeSub = subs.data.find((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    )

    if (!activeSub) {
      return NextResponse.json({ error: "Sin suscripción activa" }, { status: 404 })
    }

    const item = activeSub.items.data[0]
    const price = item?.price
    const productId = price?.product as string

    let productName = "Sin nombre"
    if (productId) {
      try {
        const product = await stripe.products.retrieve(productId)
        productName = product.name
      } catch {
        console.warn("Producto no encontrado:", productId)
        productName = "Desconocido"
      }
    }

    return NextResponse.json({
      plan: productName,
      status: activeSub.status,
      start_date: activeSub.items.data[0].current_period_start ?? null,
      endate: activeSub.items.data[0].current_period_end ?? null,
      amount: price?.unit_amount ? price.unit_amount / 100 : null,
      currency: price?.currency ?? "eur",
      cancel_at_period_end: activeSub.cancel_at_period_end,
      customerId: customer.id,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("Error en /api/stripe/email:", err)
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
