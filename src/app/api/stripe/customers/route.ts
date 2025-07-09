import { stripe } from "@/lib/stripe"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type FirestoreUser = {
  uid: string
  email: string
  name?: string
  createdAt?: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const starting_after = searchParams.get("starting_after") || undefined
  const emailQuery = searchParams.get("email")?.toLowerCase() || ""

  const normalize = (str: string) => str?.trim().toLowerCase()

  try {
    const customers = await stripe.customers.list({
      limit: 30,
      ...(starting_after && { starting_after }),
    })

    const firestoreUsersSnap = await getDocs(collection(db, "users"))
    const firestoreUsers: FirestoreUser[] = firestoreUsersSnap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as FirestoreUser[]

    const enriched = await Promise.all(
      customers.data.map(async (customer) => {
        const email = customer.email ?? ""
        if (!email) return null
        if (emailQuery && !normalize(email).includes(emailQuery)) return null

        const firestoreMatch = firestoreUsers.find(
          (user) => normalize(user.email) === normalize(email)
        )

        if (!firestoreMatch) {
          console.warn(`⚠️ No match Firebase para email Stripe: ${email}`)
          return null
        }

        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 5,
        })

        const active = subs.data.find((s) =>
          ["active", "trialing", "past_due", "unpaid"].includes(s.status)
        )

        if (!active) return null // Solo clientes con suscripciones activas

        const productId = active.items.data[0]?.price?.product
        let planName: string | null = null

        if (typeof productId === "string") {
          const product = await stripe.products.retrieve(productId)
          planName = product.name
        }

        return {
          uid: firestoreMatch.uid,
          email,
          name: firestoreMatch.name || "",
          stripeId: customer.id,
          stripeLink: `https://dashboard.stripe.com/customers/${customer.id}`,
          subStatus: active.status,
          planName,
          createdAt: firestoreMatch.createdAt || null,
        }
      })
    )

    const filtered = enriched.filter(Boolean)
    const lastCustomer = customers.data[customers.data.length - 1]

    return NextResponse.json({
      data: filtered,
      hasMore: customers.has_more,
      lastId: lastCustomer?.id || null,
    })
  } catch (error) {
    console.error("Error en /api/stripe/customers:", error)
    return NextResponse.json({ error: "Error cargando customers" }, { status: 500 })
  }
}
