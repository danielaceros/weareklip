import { NextResponse } from "next/server"
import { adminDB } from "@/lib/firebase-admin"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  if (!email) {
    return NextResponse.json({ error: "Falta el email" }, { status: 400 })
  }

  try {
    const snapshot = await adminDB
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ error: "No se encontró el usuario" }, { status: 404 })
    }

    const userDoc = snapshot.docs[0]
    return NextResponse.json({ uid: userDoc.id })
  } catch (err) {
    console.error("Error buscando UID por email:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
