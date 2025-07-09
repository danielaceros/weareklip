"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"

type ClienteActivo = {
  uid: string
  email: string
  name?: string
  planName?: string
  createdAt?: number
  subStatus?: string
}

type StripeCliente = {
  email: string
  planName?: string
  createdAt?: number
  subStatus?: string
}

export default function ClientListPage() {
  const [clientes, setClientes] = useState<ClienteActivo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastId, setLastId] = useState<string | null>(null)
  const router = useRouter()

  const normalize = (str: string) => str?.trim().toLowerCase()

  const fetchActivos = useCallback(
    async (startingAfter: string | null = null) => {
      const fetchFirestoreUsers = async (): Promise<Record<string, Partial<ClienteActivo>>> => {
        const snapshot = await getDocs(collection(db, "users"))
        const result: Record<string, Partial<ClienteActivo>> = {}
        snapshot.forEach(doc => {
          const data = doc.data()
          if (data.email) {
            result[normalize(data.email)] = {
              uid: doc.id,
              name: data.name,
              createdAt: data.createdAt,
            }
          }
        })
        return result
      }

      try {
        if (startingAfter) setLoadingMore(true)
        else setLoading(true)

        const res = await fetch(`/api/stripe/customers${startingAfter ? `?starting_after=${startingAfter}` : ""}`)
        const json = await res.json()

        if (!json?.data) throw new Error("Respuesta inválida del servidor")

        const { data, hasMore: more, lastId: newLastId } = json
        const firestoreMap = await fetchFirestoreUsers()

        const nuevosClientes: ClienteActivo[] = (data as StripeCliente[]).map((c) => {
          const match = firestoreMap[normalize(c.email)] || {}
          return {
            uid: match.uid || c.email,
            email: c.email,
            name: match.name || "",
            planName: c.planName,
            createdAt: c.createdAt,
            subStatus: c.subStatus,
          }
        })

        setClientes((prev) => {
          const seen = new Set(prev.map((c) => c.uid))
          const nuevosUnicos = nuevosClientes.filter((c) => !seen.has(c.uid))
          return [...prev, ...nuevosUnicos]
        })

        setHasMore(more)
        setLastId(newLastId)
      } catch (err) {
        console.error("Error al cargar clientes activos:", err)
        toast.error("No se pudieron cargar los clientes.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchActivos()
  }, [fetchActivos])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">👥 Clientes Activos</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map((client) => (
              <Card
                key={client.uid}
                className="p-4 cursor-pointer hover:shadow-lg transition-all border border-gray-200"
                onClick={() => router.push(`/admin/client/${client.uid}`)}
              >
                <p className="text-lg font-semibold">{client.email}</p>
                <p className="text-sm text-muted-foreground">{client.name || "Sin nombre"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">{client.planName || "Sin plan"}</Badge>
                  <Badge variant="default">
                    {client.createdAt
                      ? format(new Date(client.createdAt), "dd/MM/yyyy")
                      : "Sin fecha"}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <Button onClick={() => fetchActivos(lastId)} disabled={loadingMore}>
                {loadingMore ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
