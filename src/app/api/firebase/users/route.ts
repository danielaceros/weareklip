// src/app/api/firebase/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

// 🔹 Listar todos los usuarios
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    await adminAuth.verifyIdToken(token); // ✅ Token válido

    const snap = await adminDB
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /users error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// 🔹 Crear un usuario
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    await adminAuth.verifyIdToken(token);

    const body = await req.json();

    const ref = await adminDB.collection("users").add({
      ...body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // ✅ server-side timestamp
    });

    const newDoc = await ref.get();
    return NextResponse.json({ id: newDoc.id, ...newDoc.data() });
  } catch (err: any) {
    console.error("POST /users error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
