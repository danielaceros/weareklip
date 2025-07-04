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

  const handleSearch = async () => {
    if (!email) return toast.error("Introduce un email")
    setLoading(true)
    setUser(null)
    try {
      const res = await fetch(`/api/get-user-by-email?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error")
      setUser({ id: json.id, data: json.data as FirestoreUserData })
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || "No se encontró usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Buscar Usuario</h1>
      <div className="flex gap-2">
        <Input
          placeholder="Correo del usuario"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {user && (
        <Card className="mt-6 p-4 space-y-2 bg-white shadow">
          <h2 className="font-semibold text-lg">ID: {user.id}</h2>
          {Object.entries(user.data).map(([key, value]) => (
            <p key={key}>
              <strong>{key}:</strong>{" "}
              {value instanceof Date
                ? value.toString()
                : typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
            </p>
          ))}
        </Card>
      )}
    </div>
  )
}
