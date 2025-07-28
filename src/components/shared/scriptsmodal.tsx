"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"

interface Guion {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
  notas?: string
  createdAt?: string
}

interface ScriptEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guion: Guion
  onSave: (updatedGuion: Guion) => void
}

export default function ScriptEditorModal({
  open,
  onOpenChange,
  guion,
  onSave,
}: ScriptEditorModalProps) {
  const [titulo, setTitulo] = useState(guion.titulo)
  const [contenido, setContenido] = useState(guion.contenido)
  const [estado, setEstado] = useState(String(guion.estado))
  const [notas, setNotas] = useState(guion.notas ?? "")

  useEffect(() => {
    if (open) {
      setTitulo(guion.titulo)
      setContenido(guion.contenido)
      setEstado(String(guion.estado))
      setNotas(guion.notas ?? "")
    }
  }, [guion, open])

  const handleGuardar = async () => {
    const updatedGuion = {
      ...guion,
      titulo,
      contenido,
      estado: parseInt(estado),
      notas: estado === "1" ? notas : "",
    }

    // Enviar tarea si está en estado "Cambios"
    if (estado === "1") {
      try {
        const res = await fetch("/api/assign-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: `✏️ Revisar cambios solicitados en guión: ${titulo}`,
          }),
        })

        const data = await res.json()
        console.log("✅ Tarea asignada/respuesta del backend:", data)
      } catch (error) {
        console.error("❌ Error al asignar tarea:", error)
      }
    }

    onSave(updatedGuion)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="text-xl font-semibold">Editar Guión</DialogTitle>
      <DialogContent>
        <DialogHeader />

        <div className="space-y-4">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            aria-label="Editar título del guion"
          />

          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={6}
            placeholder="Contenido del guion"
            aria-label="Editar contenido del guion"
          />

          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger aria-label="Selecciona estado">
              <SelectValue placeholder="Selecciona estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">🆕 Nuevo</SelectItem>
              <SelectItem value="1">✏️ Cambios</SelectItem>
              <SelectItem value="2">✅ Aprobado</SelectItem>
            </SelectContent>
          </Select>

          {estado === "1" && (
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder="Indica los cambios que deseas o instrucciones al equipo"
              aria-label="Notas para cambios"
            />
          )}

          <Button className="mt-2" onClick={handleGuardar}>
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
