import { stripe } from "@/lib/stripe"
import { adminDB } from "@/lib/firebase-admin"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const customers = await stripe.customers.list({ limit: 100 })
    const activeStatuses = ["active", "trialing", "past_due", "unpaid"]

    for (const customer of customers.data) {
      const email = customer.email?.toLowerCase().trim()
      const name = customer.name?.trim() || ""

      if (!email) continue

      // Revisa si tiene suscripción activa
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 5,
      })

      const activeSub = subs.data.find((s) => activeStatuses.includes(s.status))
      if (!activeSub) continue

      // Verifica si ya existe el documento en Firestore
      const docRef = adminDB.collection("users").doc(customer.id)
      const docSnap = await docRef.get()
      if (docSnap.exists) continue // ya existe, no lo reescribimos

      // Crea el documento con estructura estándar
      await docRef.set({
        createdAt: Date.now(),
        email,
        estado: "",
        instagramUser: "",
        name,
        notas: "",
        phone: "",
        role: "client",
      })

      console.log(`✅ Cliente creado: ${customer.id} (${email})`)
    }

    return NextResponse.json({ status: "ok", message: "Clientes sincronizados con Firestore." })
  } catch (error) {
    console.error("❌ Error en /api/stripe/sync:", error)
    return NextResponse.json({ error: "Error sincronizando clientes" }, { status: 500 })
  }
}
