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
  const [estadoAnterior, setEstadoAnterior] = useState<number>(0)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (guion) {
      setEstadoAnterior(guion.estado)
    }
  }, [guion])

  const handleInputChange = (field: keyof Guion, value: string | number) => {
    if (guion) {
      onChange({ 
        ...guion, 
        [field]: value 
      })
    }
  }

  const handleEstadoChange = (value: string) => {
    const nuevoEstado = parseInt(value)
    handleInputChange('estado', nuevoEstado)
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
      if (guion.estado === 1 && estadoAnterior !== 1) {
        await asignarTareasAdmin()
        toast.success("Tareas creadas para Rubén y Hello")
      }
      
      // Actualizar estado anterior
      setEstadoAnterior(guion.estado)
      
    } catch (error) {
      console.error("Error guardando:", error)
      toast.error("Error al procesar la solicitud")
    } finally {
      setGuardando(false)
    }
  }

  if (!guion) return null

  return (
    <Dialog open={!!guion} onOpenChange={onClose}>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>Editar Guión</DialogTitle>
        </VisuallyHidden>
        
        <Input
          value={guion.titulo}
          onChange={(e) => handleInputChange('titulo', e.target.value)}
          placeholder="Título"
          disabled={guardando}
        />

        <Textarea
          value={guion.contenido}
          onChange={(e) => handleInputChange('contenido', e.target.value)}
          placeholder="Contenido"
          disabled={guardando}
        />

        <Select 
          value={String(guion.estado)} 
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

        {guion.estado === 1 && (
          <Textarea
            className="mt-2"
            value={guion.notas || ""}
            onChange={(e) => handleInputChange('notas', e.target.value)}
            placeholder="Describe los cambios que deseas o instrucciones para rehacer el guion"
            rows={4}
            disabled={guardando}
          />
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            onClick={() => onDelete(guion.firebaseId)}
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