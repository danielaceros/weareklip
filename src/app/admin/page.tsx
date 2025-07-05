"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collectionGroup, getDocs, query } from "firebase/firestore"
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

type StripeClient = {
  email: string
  subStatus: string
}

export default function AdminDashboardPage() {
  const [scriptCount, setScriptCount] = useState(0)
  const [videoCount, setVideoCount] = useState(0)
  const [clientsStats, setClientsStats] = useState({
    active: 0,
    inactive: 0,
    total: 0,
  })

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status)

  useEffect(() => {
    const loadData = async () => {
      const [firestoreResult, stripeResult] = await Promise.allSettled([
        fetchFirestoreData(),
        fetchStripeClients(),
      ])

      if (firestoreResult.status === "rejected") {
        toast.error("Error al cargar datos de Firestore")
        console.error(firestoreResult.reason)
      }

      if (stripeResult.status === "rejected") {
        toast.error("Error al obtener clientes de Stripe")
        console.error(stripeResult.reason)
      }
    }

    loadData()
  }, [])

  const fetchFirestoreData = async () => {
    const scriptsSnap = await getDocs(query(collectionGroup(db, "guiones")))
    const videosSnap = await getDocs(query(collectionGroup(db, "videos")))

    setScriptCount(scriptsSnap.size)
    setVideoCount(videosSnap.size)
  }

  const fetchStripeClients = async () => {
    const res = await fetch("/api/stripe/clients")
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error || "Fallo al consultar Stripe")
    }

    const { data }: { data: StripeClient[] } = await res.json()
    const uniqueClients = new Map<string, StripeClient>()

    for (const client of data) {
      const current = uniqueClients.get(client.email)
      if (!current || isActive(client.subStatus)) {
        uniqueClients.set(client.email, client)
      }
    }

    const deduped = Array.from(uniqueClients.values())
    const active = deduped.filter((c) => isActive(c.subStatus)).length
    const inactive = deduped.length - active

    setClientsStats({ active, inactive, total: deduped.length })
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">📊 Panel de Administración</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Totales */}
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
                  title: {
                    display: true,
                    text: "Resumen General",
                    font: { size: 16 },
                  },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Clientes activos/inactivos */}
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
                  title: {
                    display: true,
                    text: "Distribución de Clientes",
                    font: { size: 16 },
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
