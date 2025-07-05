"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

type FirestoreUserData = {
  [key: string]: unknown
}

type UserResult = {
  id: string
  data: FirestoreUserData
}

export default function AdminUsersPage() {
  const [email, setEmail] = useState("")
  const [user, setUser] = useState<UserResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async () => {
    if (!email.trim()) {
      toast.error("Introduce un correo válido")
      return
    }

    setLoading(true)
    setUser(null)
    setNotFound(false)

    try {
      const res = await fetch(`/api/get-user-by-email?email=${encodeURIComponent(email)}`)
      const json = await res.json()

      if (!res.ok || !json.id || !json.data) {
        setNotFound(true)
        throw new Error(json.error || "Usuario no encontrado")
      }

      setUser({ id: json.id, data: json.data as FirestoreUserData })
      toast.success("Usuario encontrado")
    } catch (err) {
      console.error("Error buscando usuario:", err)
      toast.error((err as Error).message || "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">🔍 Buscar Usuario por Email</h1>

      <div className="flex gap-2">
        <Input
          placeholder="correo@cliente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {notFound && (
        <p className="text-sm text-red-600 mt-4">
          ❌ No se encontró ningún usuario con ese correo.
        </p>
      )}

      {user && (
        <Card className="mt-6 p-4 space-y-2 bg-white shadow">
          <h2 className="font-semibold text-lg text-blue-600">🆔 ID del Usuario:</h2>
          <p className="mb-4">{user.id}</p>
          <div className="space-y-1">
            {Object.entries(user.data).map(([key, value]) => (
              <p key={key}>
                <strong className="capitalize">{key}:</strong>{" "}
                <span className="text-gray-700">
                  {value instanceof Date
                    ? value.toLocaleString()
                    : typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </span>
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
