"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, Timestamp } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ScriptForm() {
  const [email, setEmail] = useState("")
  const [titulo, setTitulo] = useState("")
  const [contenido, setContenido] = useState("")
  const [estado, setEstado] = useState("1")
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!email || !titulo || !contenido) {
      toast.error("Completa todos los campos")
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/get-uid-by-email?email=${email}`)
      const { uid } = await res.json()
      if (!uid) throw new Error("UID no encontrado")

      await addDoc(collection(db, `users/${uid}/guiones`), {
        titulo,
        contenido,
        estado: parseInt(estado),
        createdAt: Timestamp.now(),
      })

      toast.success("Guion creado correctamente")
      setEmail("")
      setTitulo("")
      setContenido("")
      setEstado("1")
    } catch (error) {
      console.error(error)
      toast.error("Error creando guion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-lg font-bold">Nuevo Guión</h2>

      <div className="space-y-2">
        <Label>Email del usuario</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Contenido</Label>
        <Textarea rows={6} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">🆕 Nuevo</SelectItem>
            <SelectItem value="1">✏️ Necesita Cambios</SelectItem>
            <SelectItem value="2">✅ Aprobado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleCreate} disabled={loading}>
        {loading ? "Creando..." : "Crear Guion"}
      </Button>
    </div>
  )
}
