import { NextResponse } from "next/server"
import { adminDB } from "@/lib/firebase-admin"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  if (!email) {
    return NextResponse.json({ error: "Falta el email" }, { status: 400 })
  }

  try {
    const usersQuery = adminDB
      .collection("users")
      .where("email", "==", email.trim())
      .limit(1)

    const snapshot = await usersQuery.get()

    if (snapshot.empty) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const doc = snapshot.docs[0]
    return NextResponse.json({
      uid: doc.id,
      data: doc.data(),
    })
  } catch (err) {
    console.error("Error en API get-user-by-email:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
