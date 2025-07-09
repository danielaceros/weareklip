import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { adminAuth } from "@/lib/firebase-admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
})

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.split("Bearer ")[1]

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined")
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const email = decoded.email

    if (!email) {
      return NextResponse.json({ error: "No email found in token" }, { status: 400 })
    }

    const customers = await stripe.customers.list({ email, limit: 10 })

    if (!customers.data.length) {
      return NextResponse.json(
        {
          error: "No Stripe customers found",
          status: "no_customer",
        },
        { status: 404 }
      )
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

      if (!activeSub) continue

      const item = activeSub.items.data[0]
      const price = item?.price
      const productId = price?.product as string

      let productName = "Sin nombre"
      if (productId) {
        try {
          const product = await stripe.products.retrieve(productId)
          productName = product.name
        } catch {
          productName = "Desconocido"
        }
      }

      return NextResponse.json({
        status: activeSub.status,
        plan: productName,
        current_period_end: item?.current_period_end ?? null,
        interval: price?.recurring?.interval ?? "Desconocido",
        amount: price?.unit_amount ? price.unit_amount / 100 : null,
        currency: price?.currency ?? "eur",
        cancel_at_period_end: activeSub.cancel_at_period_end,
        customerId: customer.id,
        customer: {
          name: customer.name ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          address: customer.address ?? null,
          metadata: customer.metadata ?? {},
          description: customer.description ?? null,
          created: customer.created
            ? new Date(customer.created * 1000).toISOString()
            : null,
        },
      })
    }

    return NextResponse.json(
      {
        error: `No active subscriptions for ${email}`,
        status: "no_active_subscription",
      },
      { status: 404 }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("Error fetching Stripe subscription:", err)
    return NextResponse.json(
      {
        error: err.message ?? "Internal server error",
        details: err,
      },
      { status: 500 }
    )
  }
}
