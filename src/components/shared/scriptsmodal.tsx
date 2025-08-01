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
import { handleError, showSuccess, showLoading } from "@/lib/errors"
import { logAction } from "@/lib/logs" // Importar la función de logging
import { auth } from "@/lib/firebase" // Para obtener el usuario actual
import toast from "react-hot-toast"

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
  const [isSaving, setIsSaving] = useState(false)
  
  useEffect(() => {
    if (open) {
      setTitulo(guion.titulo)
      setContenido(guion.contenido)
      setEstado(String(guion.estado))
      setNotas(guion.notas ?? "")
    }
  }, [guion, open])

  const handleGuardar = async () => {
    setIsSaving(true)
    const loadingToast = showLoading("Guardando guión...")
    
    const updatedGuion = {
      ...guion,
      titulo,
      contenido,
      estado: parseInt(estado),
      notas: estado === "1" ? notas : "",
    }

    const estadoAnterior = guion.estado
    const estadoNuevo = parseInt(estado)

    try {
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

          if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Error ${res.status}: ${errorText}`)
          }

          const contentType = res.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json()
            console.log("✅ Tarea asignada/respuesta del backend:", data)
          }
          
          showSuccess("Tarea asignada para revisión de cambios")
        } catch (error) {
          handleError(error, "Error al asignar tarea")
        }
      }

      await onSave(updatedGuion)

      // 🔥 LOGGING: Solo registrar si cambió el estado
      if (estadoAnterior !== estadoNuevo && auth.currentUser) {
        try {
          let action = ""
          let message = ""
          
          if (estadoNuevo === 1) {
            action = "cambios_solicitados"
            message = `Cliente ${auth.currentUser.email || auth.currentUser.displayName || 'Usuario'} solicitó cambios en guión: "${titulo}"`
          } else if (estadoNuevo === 2) {
            action = "aprobado"
            message = `Cliente ${auth.currentUser.email || auth.currentUser.displayName || 'Usuario'} aprobó guión: "${titulo}"`
          }

          if (action && message) {
            await logAction({
              type: "guion",
              action,
              uid: auth.currentUser.uid,
              admin: auth.currentUser.email || auth.currentUser.displayName || "Cliente",
              targetId: guion.firebaseId,
              message
            })
            
            console.log(`✅ Log registrado: ${message}`)
          }
        } catch (logError) {
          console.error("❌ Error al registrar log:", logError)
          // No mostramos error al usuario, es un proceso secundario
        }
      }

      showSuccess("Guión guardado con éxito")
      onOpenChange(false)
    } catch (error) {
      handleError(error, "Error al guardar el guión")
    } finally {
      toast.dismiss(loadingToast)
      setIsSaving(false)
    }
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

          <Button 
            className="mt-2" 
            onClick={handleGuardar}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}