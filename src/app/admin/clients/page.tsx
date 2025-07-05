"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

type Client = {
  uid: string
  email: string
  role: string
  subStatus: string
  planName: string | null
  stripeCustomerId?: string
}

function getBadgeVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case "active":
    case "trialing":
      return "default"
    case "past_due":
    case "unpaid":
      return "destructive"
    case "none":
    case "cancelled":
      return "secondary"
    case "no_customer":
    default:
      return "outline"
  }
}

const isActive = (status: string) =>
  ["active", "trialing", "past_due", "unpaid"].includes(status)

function deduplicateClients(clients: Client[]): Client[] {
  const map = new Map<string, Client>()

  for (const client of clients) {
    const existing = map.get(client.email)

    if (!existing) {
      map.set(client.email, client)
    } else {
      const existingIsActive = isActive(existing.subStatus)
      const currentIsActive = isActive(client.subStatus)

      if (!existingIsActive && currentIsActive) {
        map.set(client.email, client) // Reemplazar por activo
      }
    }
  }

  return Array.from(map.values())
}

export default function ClientsAdminPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastId, setLastId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchClients = useCallback(
    async (term = "", reset = false) => {
      if (loading || (!hasMore && !reset)) return

      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (term) params.append("email", term)
        if (lastId && !reset) params.append("starting_after", lastId)

        const res = await fetch(`/api/stripe/clients?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.data) {
          throw new Error(json.error || "Error al obtener clientes")
        }

        const { data, lastId: newLastId, hasMore: more } = json

        const updatedList = reset ? data : [...clients, ...data]
        const deduplicated = deduplicateClients(updatedList)

        setClients(deduplicated)
        setLastId(newLastId || null)
        setHasMore(more)
      } catch (error) {
        console.error(error)
        toast.error("Error al cargar clientes")
      } finally {
        setLoading(false)
      }
    },
    [clients, loading, lastId, hasMore]
  )

  const handleSearch = () => {
    setClients([])
    setLastId(null)
    setHasMore(true)
    fetchClients(search, true)
  }

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchClients(search)
        }
      },
      { threshold: 1 }
    )

    const el = bottomRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [fetchClients, hasMore, loading, search])

  const filteredClients = clients.filter((c) => {
    if (filter === "active") return isActive(c.subStatus)
    if (filter === "inactive") return !isActive(c.subStatus)
    return true
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lista de Clientes</h1>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length === 0 && !loading && (
        <p className="text-muted-foreground mt-6">No hay resultados.</p>
      )}

      {filteredClients.map((c) => (
        <Card
          key={c.stripeCustomerId || c.uid}
          className="p-4 space-y-1"
        >
          <div className="flex justify-between items-center">
            <div>
              <p>
                <strong>{c.email}</strong> {c.role && `– ${c.role}`}
              </p>
              <p>Plan: {c.planName || "-"}</p>
            </div>
            <Badge variant={getBadgeVariant(c.subStatus)}>
              {c.subStatus === "no_customer"
                ? "No registrado"
                : c.subStatus === "none"
                ? "Sin suscripción"
                : c.subStatus.charAt(0).toUpperCase() + c.subStatus.slice(1)}
            </Badge>
          </div>
        </Card>
      ))}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-t-transparent border-primary rounded-full animate-spin" />
        </div>
      )}

      <div ref={bottomRef} className="h-10" />
    </div>
  )
}
