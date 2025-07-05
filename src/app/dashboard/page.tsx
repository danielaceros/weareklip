"use client"

import { useEffect, useState, useCallback } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bar, Pie } from "react-chartjs-2"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js"

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

type SubscriptionStatus =
  | "loading"
  | "active"
  | "trialing"
  | "incomplete"
  | "canceled"
  | "no_active"

interface DashboardStats {
  guiones: {
    nuevos: number
    cambios: number
    aprobados: number
  }
  videos: number
  subscripcion: {
    status: SubscriptionStatus
    plan: string
    renovacion: string
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    guiones: { nuevos: 0, cambios: 0, aprobados: 0 },
    videos: 0,
    subscripcion: {
      status: "loading",
      plan: "Desconocido",
      renovacion: "Desconocida",
    },
  })

  const fetchData = useCallback(async (user: any) => {
    try {
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok || !data?.status) {
        throw new Error(data?.error || "No se pudo obtener la suscripción.")
      }

      // Aquí podrías reemplazar con datos reales desde Firestore
      const guiones = { nuevos: 3, cambios: 1, aprobados: 6 }
      const videos = 12

      setStats({
        guiones,
        videos,
        subscripcion: {
          status: data.status ?? "no_active",
          plan: data.plan ?? "Desconocido",
          renovacion: data.current_period_end
            ? new Date(data.current_period_end * 1000).toLocaleDateString("es-ES")
            : "Desconocida",
        },
      })
    } catch (error: any) {
      console.error("Error al cargar dashboard:", error)
      toast.error("Error al cargar la suscripción", {
        description: error?.message ?? "Error desconocido",
      })
      setStats((prev) => ({
        ...prev,
        subscripcion: {
          status: "no_active",
          plan: "No activa",
          renovacion: "Desconocida",
        },
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Debes iniciar sesión para ver tu panel.",
        })
        setLoading(false)
        return
      }
      fetchData(user)
    })
    return () => unsubscribe()
  }, [fetchData])

  const pieData = {
    labels: ["Nuevos", "Cambios", "Aprobados"],
    datasets: [
      {
        label: "Guiones",
        data: [
          stats.guiones.nuevos,
          stats.guiones.cambios,
          stats.guiones.aprobados,
        ],
        backgroundColor: ["#F87171", "#FACC15", "#4ADE80"],
      },
    ],
  }

  const barData = {
    labels: ["Vídeos"],
    datasets: [
      {
        label: "Total",
        data: [stats.videos],
        backgroundColor: "#60A5FA",
      },
    ],
  }

  const renderBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Activa</Badge>
      case "trialing":
        return <Badge variant="default">En prueba</Badge>
      case "incomplete":
      case "canceled":
      case "no_active":
      default:
        return <Badge variant="destructive">Inactiva o cancelada</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground animate-pulse">
        <p className="text-lg">🔄 Cargando tu dashboard...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">¡Hola! 👋 Bienvenido a tu Panel</h1>
      <p className="text-muted-foreground">
        Desde aquí puedes gestionar tus guiones, vídeos y suscripción. ¡Vamos allá! 🚀
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Estado de tus Guiones 📜</h2>
          <Pie data={pieData} />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-2">Resumen de Vídeos 🎬</h2>
          <Bar data={barData} options={{ indexAxis: "y" }} />
        </Card>

        <Card className="p-4 space-y-2">
          <h2 className="font-semibold mb-2">Tu Suscripción 💳</h2>
          <p>
            Plan:{" "}
            <strong className="text-primary">{stats.subscripcion.plan}</strong>
          </p>
          <p>
            Renovación:{" "}
            <strong className="text-primary">{stats.subscripcion.renovacion}</strong>
          </p>
          {renderBadge(stats.subscripcion.status)}
        </Card>
      </div>
    </div>
  )
}
