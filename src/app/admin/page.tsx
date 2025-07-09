"use client"

import { useEffect, useState, useCallback } from "react"
import { db } from "@/lib/firebase"
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Bar, Pie } from "react-chartjs-2"
import {
  Chart,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js"

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title)

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

export default function AdminDashboardPage() {
  const [scriptCount, setScriptCount] = useState(0)
  const [videoCount, setVideoCount] = useState(0)
  const [clientsStats, setClientsStats] = useState({ active: 0, inactive: 0, total: 0 })
  const [clients, setClients] = useState<ClienteCompleto[]>([])
  const [lastId, setLastId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status)

  const fetchFirestoreUsers = async () => {
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

  const sendNotificationEmail = async (
    to: string,
    subject: string,
    content: string
  ) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, content }),
      });
    } catch (err) {
      console.error("Error enviando correo:", err);
    }
  };

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

  const loadStripeClients = useCallback(
    async (startingAfter: string | null = null) => {
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

        const active = stripeRes.data.filter((c) => isActive(c.subStatus || "")).length
        const inactive = stripeRes.data.length - active

        setClientsStats((prev) => ({
          active: prev.active + active,
          inactive: prev.inactive + inactive,
          total: prev.total + stripeRes.data.length,
        }))
      } catch (err) {
        console.error(err)
        toast.error("Error al cargar clientes")
      } finally {
        setLoadingMore(false)
      }
    },
    []
  )

  const fetchFirestoreData = useCallback(async () => {
    try {
      const scriptsSnap = await getDocs(query(collectionGroup(db, "guiones")))
      const videosSnap = await getDocs(query(collectionGroup(db, "videos")))

      setScriptCount(scriptsSnap.size)
      setVideoCount(videosSnap.size)
    } catch (error) {
      console.error(error)
      toast.error("Error al cargar Firestore")
    }
  }, [])

  const handleChange = async (
    uid: string,
    field: "estado" | "notas",
    value: string
  ) => {
    setClients((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, [field]: value } : c))
    );

    const client = clients.find((c) => c.uid === uid);
    if (!client) return;

    try {
      await setDoc(
        doc(db, "users", uid),
        { [field]: value },
        { merge: true }
      );
      toast.success(`Campo "${field}" actualizado`);

      if (field === "estado") {
        const name = client.name || "cliente";
        const estado = value || "Sin estado";

        const htmlContent = `
          Hola ${name},<br/><br/>
          Tu estado ahora es: <strong>${estado}</strong>.<br/><br/>
          Puedes consultar tu panel en cualquier momento para seguir el proceso.
        `;

        await sendNotificationEmail(
          "rubengomezklip@gmail.com",
          "Tu estado ha sido actualizado",
          htmlContent
        );
      }
    } catch (err) {
      console.error("Error al guardar cambios:", err);
      toast.error("Error al guardar cambios");
    }
  }

  useEffect(() => {
    fetchFirestoreData()
    loadStripeClients()
  }, [fetchFirestoreData, loadStripeClients])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">📊 Panel de Administración</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Totales del Sistema</h2>
            <Bar
              data={{
                labels: ["Guiones", "Vídeos", "Clientes"],
                datasets: [
                  {
                    label: "Total",
                    data: [scriptCount, videoCount, clientsStats.total],
                    backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981"],
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: "Resumen General", font: { size: 16 } },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                },
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Clientes por Estado</h2>
            <Pie
              data={{
                labels: ["Activos", "Inactivos"],
                datasets: [
                  {
                    data: [clientsStats.active, clientsStats.inactive],
                    backgroundColor: ["#22c55e", "#ef4444"],
                    borderColor: "#fff",
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "bottom" },
                  title: { display: true, text: "Distribución de Clientes", font: { size: 16 } },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
      <CardContent className="p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Clientes activos</h2>
        <table className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Correo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Pack</th>
              <th className="px-4 py-3 text-left">Subscripción</th>
              <th className="px-4 py-3 text-left">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients
              .filter((client) => isActive(client.subStatus || ""))
              .map((client) => (
                <tr key={client.uid} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">{client.name || "-"}</td>
                  <td className="px-4 py-3">{client.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={client.estado || ""}
                      onChange={(e) => handleChange(client.uid, "estado", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">🟡 Sin estado</option>
                      <option value="Nuevo Cliente">🆕 Nuevo Cliente</option>
                      <option value="Onboarding">🚀 Onboarding</option>
                      <option value="Enviar Vídeo Dani">🎥 Enviar Vídeo Dani</option>
                      <option value="Generar Guión">✍️ Generar Guión</option>
                      <option value="Esperando Confirmación Guión">⏳ Confirmación Guión</option>
                      <option value="Esperando Clonación">🧬 Esperando Clonación</option>
                      <option value="Generar Vídeo">🎬 Generar Vídeo</option>
                      <option value="Enviado a Editor">🛠️ Enviado a Editor</option>
                      <option value="Revisar Vídeo">🔍 Revisar Vídeo</option>
                      <option value="Programado">📅 Programado</option>
                      <option value="Finalizado">✅ Finalizado</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{client.planName || "-"}</td>
                  <td className="px-4 py-3">
                    {client.createdAt
                      ? new Date(client.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={client.notas || ""}
                      onChange={(e) =>
                        handleChange(client.uid, "notas", e.target.value)
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>


        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => loadStripeClients(lastId)}
              disabled={loadingMore}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              {loadingMore ? "Cargando..." : "Cargar más"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
