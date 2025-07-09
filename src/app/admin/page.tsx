"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore"
import ClientsTable from "@/components/shared/clientstable"

// ----------------------------
// Tipos
// ----------------------------
type ClienteCompleto = {
  uid: string
  email: string
  name?: string
  estado?: string
  notas?: string
  subStatus?: string
  planName?: string
  createdAt?: number
}

type StripeResponse = {
  data: ClienteCompleto[]
  hasMore: boolean
  lastId: string | null
}

// ----------------------------
// Funciones auxiliares integradas
// ----------------------------
const fetchFirestoreUsers = async (): Promise<ClienteCompleto[]> => {
  const usersSnap = await getDocs(collection(db, "users"))
  return usersSnap.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  })) as ClienteCompleto[]
}

const fetchStripeClientsPage = async (startingAfter?: string | null): Promise<StripeResponse> => {
  const res = await fetch(`/api/stripe/clients${startingAfter ? `?starting_after=${startingAfter}` : ""}`)
  if (!res.ok) throw new Error("Error cargando clientes de Stripe")
  return await res.json()
}

const ensureUserExists = async (client: ClienteCompleto): Promise<string> => {
  const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", client.email)))
  if (!usersSnap.empty) return usersSnap.docs[0].id

  const docRef = doc(collection(db, "users"))
  await setDoc(docRef, {
    email: client.email,
    name: client.name || "",
    phone: "",
    instagramUser: "",
    role: "client",
    estado: "",
    notas: "",
    createdAt: Date.now(),
  })
  return docRef.id
}

const sendNotificationEmail = async (to: string, subject: string, content: string) => {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, content }),
    })
  } catch (err) {
    console.error("Error enviando correo:", err)
  }
}

// ----------------------------
// Componente principal
// ----------------------------
export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClienteCompleto[]>([])
  const [lastId, setLastId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const router = useRouter()

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status)

  const loadStripeClients = useCallback(async (startingAfter: string | null = null) => {
    try {
      setLoadingMore(true)

      const stripeRes = await fetchStripeClientsPage(startingAfter)
      const firestoreUsers = await fetchFirestoreUsers()

      const merged: ClienteCompleto[] = []

      for (const stripeClient of stripeRes.data) {
        const uid = await ensureUserExists(stripeClient)
        const match = firestoreUsers.find((u) => u.email === stripeClient.email)
        merged.push({ ...stripeClient, ...match, uid })
      }

      setClients((prev) => {
        const newClients = merged.filter(
          (newClient) => !prev.some((existing) => existing.uid === newClient.uid)
        )
        return [...prev, ...newClients]
      })

      setLastId(stripeRes.lastId)
      setHasMore(stripeRes.hasMore)
    } catch (err) {
      console.error(err)
      toast.error("Error al cargar clientes")
    } finally {
      setLoadingMore(false)
    }
  }, [])

  const handleChange = async (uid: string, field: "estado" | "notas", value: string) => {
    setClients((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, [field]: value } : c))
    )

    const client = clients.find((c) => c.uid === uid)
    if (!client) return

    try {
      await fetch("/api/clients/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, field, value }),
      })

      if (field === "estado") {
        const htmlContent = `
          Hola ${client.name || "cliente"},<br/><br/>
          Tu estado ahora es: <strong>${value || "Sin estado"}</strong>.
        `
        await sendNotificationEmail(
          "rubengomezklip@gmail.com",
          "Tu estado ha sido actualizado",
          htmlContent
        )
      }
    } catch (err) {
      console.error("Error al guardar cambios:", err)
      toast.error("Error al guardar cambios")
    }
  }

  useEffect(() => {
    loadStripeClients()
  }, [loadStripeClients])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">📋 Estados de Clientes</h1>
      <ClientsTable
        clients={clients}
        isActive={isActive}
        onChange={handleChange}
        onRowClick={(uid) => router.push(`/admin/client/${uid}`)}
        onLoadMore={() => loadStripeClients(lastId)}
        hasMore={hasMore}
        loadingMore={loadingMore}
      />
    </div>
  )
}
