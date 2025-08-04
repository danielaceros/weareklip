// /app/api/clients/route.ts
import { NextResponse } from "next/server"
import { adminDB } from "@/lib/firebase-admin"  // <-- Admin SDK instancia

export async function POST(req: Request) {
  try {
    const { uid, field, value } = await req.json()

    if (!uid || !field) {
      return NextResponse.json(
        { error: "Faltan campos uid o field" },
        { status: 400 }
      )
    }

    if (!["estado", "notas"].includes(field)) {
      return NextResponse.json(
        { error: "Campo 'field' no permitido" },
        { status: 400 }
      )
    }

    await adminDB.collection("users").doc(uid).update({
      [field]: value,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error actualizando Firestore con Admin SDK:", error)
    return NextResponse.json(
      { error: "Error actualizando Firestore", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
