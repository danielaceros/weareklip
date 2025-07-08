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

  const loadStripeClients = useCallback(
    async (startingAfter: string | null = null) => {
      try {
        setLoadingMore(true)

        const [stripeRes, firestoreUsers] = await Promise.all([
          fetchStripeClientsPage(startingAfter),
          fetchFirestoreUsers(),
        ])

        const merged = stripeRes.data.map((stripeClient) => {
          const match = firestoreUsers.find((u) => u.email === stripeClient.email)
          return { ...stripeClient, ...match }
        })

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

  const handleChange = (uid: string, field: "estado" | "notas", value: string) => {
    setClients((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, [field]: value } : c))
    )
  }

  const handleSave = async (uid: string) => {
    const client = clients.find((c) => c.uid === uid)
    if (!client) return
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          estado: client.estado || "",
          notas: client.notas || "",
        },
        { merge: true }
      )
      toast.success("Cliente actualizado")
    } catch (err) {
      console.error(err)
      toast.error("Error al guardar cambios")
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
          <h2 className="text-lg font-semibold mb-4">Clientes detallados</h2>
          <table className="min-w-full text-sm border border-gray-300 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Correo</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Pack</th>
                <th className="px-4 py-2 text-left">Subscripción</th>
                <th className="px-4 py-2 text-left">Notas</th>
                <th className="px-4 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.uid} className="border-t">
                  <td className="px-4 py-2">{client.name || "-"}</td>
                  <td className="px-4 py-2">{client.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={client.estado || ""}
                      onChange={(e) => handleChange(client.uid, "estado", e.target.value)}
                      className="bg-white border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">Sin estado</option>
                      <option value="activo">Activo</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">{client.planName || "-"}</td>
                  <td className="px-4 py-2">
                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={client.notas || ""}
                      onChange={(e) => handleChange(client.uid, "notas", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleSave(client.uid)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="mt-4 text-center">
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
