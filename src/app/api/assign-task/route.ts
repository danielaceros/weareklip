import { adminDB } from "@/lib/firebase-admin"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: Request) {
  try {
    const { description } = await req.json()
    
    // Emails de los administradores objetivo
    const targetAdmins = [
      "rubengomezklip@gmail.com",
      "hello@weareklip.com"
    ]

    // Buscar todos los administradores relevantes
    const adminsQuery = adminDB.collection("admin")
      .where("email", "in", targetAdmins)
    const adminsSnapshot = await adminsQuery.get()

    if (adminsSnapshot.empty) {
      return NextResponse.json(
        { message: "No se encontraron administradores" },
        { status: 404 }
      )
    }

    const now = Date.now()
    const batch = adminDB.batch() // Usamos batch para operaciones atómicas
    const newTaskIds = [] // Para seguimiento de IDs creadas

    // Procesar cada administrador
    for (const adminDoc of adminsSnapshot.docs) {
      const tasksRef = adminDoc.ref.collection("tasks")
      
      // Verificar duplicados
      const dupQuery = await tasksRef
        .where("descripcion", "==", description)
        .limit(1)
        .get()

      if (dupQuery.empty) {
        const newId = uuidv4()
        newTaskIds.push(newId)
        
        const newTaskRef = tasksRef.doc(newId)
        batch.set(newTaskRef, {
          id: newId,
          descripcion: description,
          estado: "Nuevo",
          creadoEn: now,
          fechaFin: now + 7 * 86400000, // 7 días
          createdBy: "auto"
        })
      }
    }

    // Ejecutar todas las operaciones en una sola transacción
    if (newTaskIds.length > 0) {
      await batch.commit()
    }

    return NextResponse.json({
      message: "Tareas procesadas",
      createdCount: newTaskIds.length,
      totalAdmins: adminsSnapshot.size
    }, { 
      status: newTaskIds.length > 0 ? 201 : 200 
    })
    
  } catch (error) {
    console.error("Error en POST /api/assign-task:", error)
    return NextResponse.json(
      { message: "Error interno del servidor", error: (error as Error).message },
      { status: 500 }
    )
  }
}