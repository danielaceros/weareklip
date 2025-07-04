// /app/api/stripe/clients/route.ts
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {})

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const emailQuery = searchParams.get("email")?.toLowerCase()
  const startingAfter = searchParams.get("starting_after") || undefined

  try {
    const customers = await stripe.customers.list({
      limit: 20,
      ...(startingAfter && { starting_after: startingAfter }),
    })

    const results = await Promise.all(
      customers.data.map(async (customer) => {
        const email = customer.email ?? ""
        if (emailQuery && !email.toLowerCase().includes(emailQuery)) return null

        let subStatus: string = "no_subscription"
        let planName: string | null = null

        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 5,
        })

        const active = subs.data.find((s) =>
          ["active", "trialing", "past_due", "unpaid"].includes(s.status)
        )

        if (active) {
          subStatus = active.status
          const productId = active.items.data[0]?.price?.product
          if (typeof productId === "string") {
            const product = await stripe.products.retrieve(productId)
            planName = product.name
          }
        } else if (subs.data.length > 0) {
          subStatus = "cancelled"
        }

        return {
          uid: customer.id,
          email,
          role: customer.metadata?.role ?? "",
          subStatus,
          planName,
        }
      })
    )

    const filtered = results.filter(Boolean)

    return NextResponse.json({
      data: filtered,
      lastId: customers.data.at(-1)?.id ?? null,
      hasMore: customers.has_more,
    })
  } catch (err) {
    console.error("Error Stripe API:", err)
    return NextResponse.json({ data: [], error: "Internal server error" }, { status: 500 })
  }
}
