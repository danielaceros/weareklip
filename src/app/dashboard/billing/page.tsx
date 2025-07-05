"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import clsx from "clsx"

interface StripeSubscription {
  status: string
  plan: string
  current_period_end: number | null
  amount: number | null
  interval: string
  currency: string
  cancel_at_period_end: boolean
  customer: {
    name: string | null
    email: string | null
    phone: string | null
    address: {
      city?: string
      country?: string
      line1?: string
      line2?: string
      postal_code?: string
      state?: string
    } | null
    created: string | null
  }
}

export default function BillingPage() {
  const [sub, setSub] = useState<StripeSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        toast.error("No estás autenticado", {
          description: "Inicia sesión para ver tus datos de suscripción.",
        })
        setLoading(false)
        return
      }

      try {
        const token = await user.getIdToken()
        const res = await fetch("/api/stripe/subscription", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err?.error || "No se pudo obtener la suscripción")
        }

        const data: StripeSubscription = await res.json()
        setSub(data)
      } catch (error: any) {
        console.error("Error al cargar la suscripción:", error)
        toast.error("Error al obtener la suscripción", {
          description: error.message ?? "Ocurrió un error inesperado.",
        })
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "No disponible"
    return new Date(timestamp * 1000).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300"
      case "trialing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "past_due":
        return "bg-orange-100 text-orange-700 border-orange-300"
      case "unpaid":
        return "bg-red-100 text-red-700 border-red-300"
      case "canceled":
        return "bg-gray-200 text-gray-600 border-gray-300"
      default:
        return "bg-gray-100 text-gray-600 border-gray-300"
    }
  }

  const formatAddress = (addr: StripeSubscription["customer"]["address"]) => {
    if (!addr) return "No disponible"
    return [addr.line1, addr.line2, addr.postal_code, addr.city, addr.state, addr.country]
      .filter(Boolean)
      .join(", ")
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Mi Suscripción</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando suscripción...</p>
      ) : sub ? (
        <>
          {/* Datos del cliente */}
          <div className="space-y-2 border border-border rounded-xl p-4 shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-2">Datos del Cliente</h2>
            <p>
              <strong>Nombre:</strong> {sub.customer.name ?? "No disponible"}
            </p>
            <p>
              <strong>Email:</strong> {sub.customer.email ?? "No disponible"}
            </p>
            <p>
              <strong>Teléfono:</strong> {sub.customer.phone ?? "No disponible"}
            </p>
            <p>
              <strong>Dirección:</strong> {formatAddress(sub.customer.address)}
            </p>
            <p>
              <strong>Cliente desde:</strong>{" "}
              {sub.customer.created
                ? new Date(sub.customer.created).toLocaleDateString("es-ES")
                : "No disponible"}
            </p>
          </div>

          {/* Datos de suscripción */}
          <div className="space-y-4 border border-border rounded-xl p-4 shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-2">Datos de Facturación</h2>

            <div className="flex items-center gap-2">
              <span className="font-medium">Estado:</span>
              <span
                className={clsx(
                  "px-3 py-1 rounded-full text-sm border",
                  getStatusChipStyle(sub.status)
                )}
              >
                {sub.status}
              </span>
            </div>

            <div className="space-y-1">
              <p>
                <strong>Plan:</strong> {sub.plan}
              </p>
              <p>
                <strong>Precio:</strong>{" "}
                {sub.amount
                  ? `${sub.amount.toFixed(2)} ${sub.currency.toUpperCase()} / ${sub.interval}`
                  : "No disponible"}
              </p>
              <p>
                <strong>Renovación:</strong> {formatDate(sub.current_period_end)}
              </p>
              <p>
                <strong>¿Se cancelará al final del periodo?</strong>{" "}
                {sub.cancel_at_period_end ? "Sí" : "No"}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">No tienes suscripción activa.</p>
      )}

      <Button className="mt-6" asChild>
        <a
          href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir portal de facturación
        </a>
      </Button>
    </div>
  )
}
