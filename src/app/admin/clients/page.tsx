"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import ClienteList from "@/components/shared/clientlist"
import ClienteSkeletonGrid from "@/components/shared/clientskeleton"

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

  const normalize = (str: string) => str?.trim().toLowerCase()

  const fetchFirestoreUsers = useCallback(async (): Promise<Record<string, Partial<ClienteActivo>>> => {
    const snapshot = await getDocs(collection(db, "users"))
    const result: Record<string, Partial<ClienteActivo>> = {}
    snapshot.forEach((doc) => {
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
  }, [])

  const fetchActivos = useCallback(
    async (startingAfter: string | null = null) => {
      try {
        if (startingAfter) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }

        const res = await fetch(`/api/stripe/customers${startingAfter ? `?starting_after=${startingAfter}` : ""}`)
        const json = await res.json()
        if (!json?.data) throw new Error("Respuesta inválida")

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
        console.error("Error al cargar clientes:", err)
        toast.error("No se pudieron cargar los clientes.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [fetchFirestoreUsers]
  )

  useEffect(() => {
    fetchActivos()
  }, [fetchActivos])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">👥 Clientes Activos</h1>

      {loading ? (
        <ClienteSkeletonGrid />
      ) : (
        <>
          <ClienteList clientes={clientes} />

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
