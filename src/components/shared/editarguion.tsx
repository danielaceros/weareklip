"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Guion = {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
  notas?: string
}

type Props = {
  guion: Guion | null
  onClose: () => void
  onChange: (guion: Guion) => void
  onDelete: (id: string) => void
  onSave: () => void
}

export default function EditarGuionModal({
  guion,
  onClose,
  onChange,
  onDelete,
  onSave,
}: Props) {
  const [estado, setEstado] = useState("0")
  const [estadoAnterior, setEstadoAnterior] = useState("0")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (guion) {
      setEstado(String(guion.estado))
      setEstadoAnterior(String(guion.estado))
    }
  }, [guion])

  const handleEstadoChange = (value: string) => {
    if (guion) {
      setEstado(value)
      onChange({ ...guion, estado: parseInt(value) })
    }
  }

  const handleNotasChange = (value: string) => {
    if (guion) {
      onChange({ ...guion, notas: value })
    }
  }

  // Función para asignar tareas a Rubén y Hello
  const asignarTareasAdmin = async () => {
    if (!guion) return
    
    try {
      const res = await fetch('/api/assign-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: guion.titulo
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Error al asignar tareas")
      }
      
      return await res.json()
    } catch (error) {
      console.error("Error asignando tareas:", error)
      throw error
    }
  }

  const handleSave = async () => {
    if (!guion) return
    setGuardando(true)
    
    try {
      // Guardar cambios normales
      onSave()
      
      // Verificar si el estado cambió a "necesita cambios" (1)
      if (estado === "1" && estadoAnterior !== "1") {
        await asignarTareasAdmin()
        toast.success("Tareas creadas para Rubén y Hello")
      }
      
      // Actualizar estado anterior
      setEstadoAnterior(estado)
      
    } catch (error) {
      console.error("Error guardando:", error)
      toast.error("Error al procesar la solicitud")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!guion} onOpenChange={onClose}>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>Editar Guión</DialogTitle>
        </VisuallyHidden>
        <Input
          value={guion?.titulo || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, titulo: e.target.value })
          }
          placeholder="Título"
          disabled={guardando}
        />

        <Textarea
          value={guion?.contenido || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, contenido: e.target.value })
          }
          placeholder="Contenido"
          disabled={guardando}
        />

        <Select 
          value={estado} 
          onValueChange={handleEstadoChange}
          disabled={guardando}
        >
          <SelectTrigger className="mt-2">
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
            className="mt-2"
            value={guion?.notas || ""}
            onChange={(e) => handleNotasChange(e.target.value)}
            placeholder="Describe los cambios que deseas o instrucciones para rehacer el guion"
            rows={4}
            disabled={guardando}
          />
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            onClick={() => guion && onDelete(guion.firebaseId)}
            disabled={guardando}
          >
            Eliminar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}