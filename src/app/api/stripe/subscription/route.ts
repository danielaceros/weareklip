import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
})

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    const token = authHeader?.split("Bearer ")[1]

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 })
    }

    const decoded = await getAuth().verifyIdToken(token)
    const email = decoded.email

    if (!email) {
      return NextResponse.json({ error: "No email in token" }, { status: 400 })
    }

    const customers = await stripe.customers.list({ email, limit: 10 })

    if (!customers.data.length) {
      return NextResponse.json({ error: "No Stripe customers found" }, { status: 404 })
    }

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 5,
      })

    const activeSub = subs.data.find((s) =>
    ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    )

      if (activeSub) {
        const price = activeSub.items.data[0]?.price
        const productId = price?.product as string

        let productName = "Sin nombre"
        if (productId) {
          try {
            const product = await stripe.products.retrieve(productId)
            productName = product.name
          } catch {
            // no pasa nada si falla
          }
        }

        return NextResponse.json({
          status: activeSub.status,
          plan: productName,
          current_period_end: activeSub.items.data[0].current_period_end ?? null,
          customerId: customer.id,
          interval: price?.recurring?.interval ?? "No disponible",
          amount: price?.unit_amount ? price.unit_amount / 100 : null,
          currency: price?.currency ?? "eur",
          cancel_at_period_end: activeSub.cancel_at_period_end,
           customer: {
            name: customer.name ?? null,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            address: customer.address ?? null,
            metadata: customer.metadata ?? {},
            description: customer.description ?? null,
            created: customer.created ? new Date(customer.created * 1000).toISOString() : null,
          },
        })
      }
    }

    return NextResponse.json({ error: `No active subscriptions for ${email}` }, { status: 404 })
  } catch (error) {
    console.error("Error fetching Stripe subscription", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
