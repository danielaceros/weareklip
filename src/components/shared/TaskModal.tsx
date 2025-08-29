"use client"

import { SetStateAction, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, updateDoc } from "firebase/firestore"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

type Task = {
  id: string
  descripcion: string
  estado: "Nuevo" | "Hecho"
  createdAt: number
  fechaFin: number
}

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adminId: string
  task: Task | null
}

export default function TaskModal({ open, onOpenChange, adminId, task }: TaskModalProps) {
  const [descripcion, setDescripcion] = useState("")
  const [estado, setEstado] = useState<"Nuevo" | "Hecho">("Nuevo")
  const [fechaFin, setFechaFin] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setDescripcion(task.descripcion || "")
      setEstado(task.estado || "Nuevo")
      setFechaFin(task.fechaFin ? new Date(task.fechaFin) : null)
    } else {
      setDescripcion("")
      setEstado("Nuevo")
      setFechaFin(null)
    }
  }, [task, open])

  const handleSave = async () => {
    if (!descripcion.trim()) {
      toast.error("La descripción es obligatoria.");
      return;
    }

    if (!fechaFin) {
      toast.error("La fecha de fin es obligatoria.");
      return;
    }

    try {
      setSaving(true);

      const id = task?.id || uuidv4();
      const payload: Task = {
        id,
        descripcion,
        estado,
        createdAt: task?.createdAt || Date.now(),
        fechaFin: fechaFin.getTime(),
      };

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      const res = await fetch(`/api/firebase/admin/${adminId}/tasks/${id}`, {
        method: task ? "PUT" : "POST", // PUT si existe, POST si es nuevo
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      toast.success(task ? "Tarea actualizada" : "Tarea creada");
      onOpenChange(false);
    } catch (err) {
      console.error("❌ Error handleSave:", err);
      toast.error("Error al guardar la tarea");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="text-xl font-semibold">Crear Tarea</DialogTitle>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Descripción de la tarea"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              Estado:
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as "Nuevo" | "Hecho")}
                className="border px-2 py-1 rounded-md text-sm"
              >
                <option value="Nuevo">🆕 Nuevo</option>
                <option value="Hecho">✅ Hecho</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              Fecha fin:
              <DatePicker
                selected={fechaFin}
                onChange={(date: SetStateAction<Date | null>) => setFechaFin(date)}
                className="border px-2 py-1 rounded-md text-sm"
                dateFormat="dd/MM/yyyy"
                minDate={new Date()}
                required
              />
            </label>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Guardar tarea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
