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
    const fetchData = async () => {
      try {
        await Promise.all([fetchFirestoreData(), fetchStripeClients()])
      } catch {
        toast.error("Error al cargar el dashboard.")
      }
    }

    fetchData()
  }, [])

  const fetchFirestoreData = async () => {
    try {
      const scriptsSnap = await getDocs(query(collectionGroup(db, "guiones")))
      const videosSnap = await getDocs(query(collectionGroup(db, "videos")))

      setScriptCount(scriptsSnap.size)
      setVideoCount(videosSnap.size)
    } catch (err) {
      console.error(err)
      toast.error("Error al cargar datos de Firestore")
    }
  }

  const fetchStripeClients = async () => {
    try {
      const res = await fetch("/api/stripe/clients")
      if (!res.ok) throw new Error("Fallo en la consulta a Stripe")

      const { data }: { data: StripeClient[] } = await res.json()
      const uniqueEmails = new Map<string, StripeClient>()

      data.forEach((client) => {
        const current = uniqueEmails.get(client.email)
        if (!current || isActive(client.subStatus)) {
          uniqueEmails.set(client.email, client)
        }
      })

      const deduplicated = Array.from(uniqueEmails.values())
      const active = deduplicated.filter((c) => isActive(c.subStatus)).length
      const inactive = deduplicated.length - active

      setClientsStats({ active, inactive, total: deduplicated.length })
    } catch (err) {
      console.error(err)
      toast.error("Error al obtener clientes de Stripe")
    }
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
