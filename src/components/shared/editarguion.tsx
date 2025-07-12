"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

  useEffect(() => {
    if (guion) {
      setEstado(String(guion.estado))
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

  return (
    <Dialog open={!!guion} onOpenChange={onClose}>
      <DialogTitle>Editar Guion</DialogTitle>
      <DialogContent>
        <Input
          value={guion?.titulo || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, titulo: e.target.value })
          }
          placeholder="Título"
        />

        <Textarea
          value={guion?.contenido || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, contenido: e.target.value })
          }
          placeholder="Contenido"
        />

        <Select value={estado} onValueChange={handleEstadoChange}>
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
          />
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            onClick={() => guion && onDelete(guion.firebaseId)}
          >
            Eliminar
          </Button>
          <Button onClick={onSave}>Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
