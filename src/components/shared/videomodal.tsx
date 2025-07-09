"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download } from "lucide-react"
import React from "react"

interface VideoEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  url: string
  estado: string
  onTituloChange: (val: string) => void
  onEstadoChange: (val: string) => void
  onDownload: () => void
  onGuardar: () => void
}

export default function VideoEditorModal({
  open,
  onOpenChange,
  titulo,
  url,
  estado,
  onTituloChange,
  onEstadoChange,
  onDownload,
  onGuardar,
}: VideoEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Input
              type="text"
              value={titulo}
              onChange={(e) => onTituloChange(e.target.value)}
              className="w-110 border-b border-gray-300 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 rounded"
              placeholder="Editar título"
              aria-label="Editar título del vídeo"
            />
          </DialogTitle>
        </DialogHeader>

        <video
          src={url}
          controls
          className="w-full max-w-[320px] max-h-[568px] rounded mx-auto object-contain"
          preload="metadata"
          aria-label={`Previsualización del vídeo ${titulo}`}
        />

        <div className="mt-4 flex flex-col sm:flex-row sm:justify-between gap-4 items-center">
          <Button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            aria-label="Descargar vídeo"
          >
            <Download className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            <Select value={estado} onValueChange={onEstadoChange}>
              <SelectTrigger className="w-48" aria-label="Selecciona estado">
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">🆕 Nuevo</SelectItem>
                <SelectItem value="1">✏️ Cambios</SelectItem>
                <SelectItem value="2">✅ Aprobado</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={onGuardar}>Guardar cambios</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
