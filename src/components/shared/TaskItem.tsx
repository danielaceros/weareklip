"use client"

import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Pencil, Trash2, CheckCircle } from "lucide-react"
import { useMemo } from "react"

interface TaskItemProps {
  descripcion: string
  fechaFin?: number
  estado: "Nuevo" | "Hecho"
  onEdit: () => void
  onDelete: () => void
  onToggleDone: () => void
}

export default function TaskItem({
  descripcion,
  fechaFin,
  estado,
  onEdit,
  onDelete,
  onToggleDone,
}: TaskItemProps) {
  const colorClass = useMemo(() => {
    if (estado === "Hecho") return "bg-gray-200 text-gray-500 line-through"

    if (!fechaFin) return "bg-neutral-100"
    const today = new Date()
    const end = new Date(fechaFin)
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) return "bg-red-500 text-white"
    if (diffDays <= 3) return "bg-orange-400 text-white"
    if (diffDays <= 7) return "bg-yellow-300 text-black"
    return "bg-green-200 text-black"
  }, [fechaFin, estado])

  return (
    <div
      className={cn(
        "rounded-md p-4 flex justify-between items-center shadow-sm",
        colorClass
      )}
    >
      <div className="flex-1 cursor-pointer" onClick={onToggleDone}>
        <p className="text-sm">{descripcion}</p>
        {fechaFin && (
          <p className="text-xs mt-1 opacity-80">
            📅 Vence: {format(new Date(fechaFin), "dd/MM/yyyy")}
          </p>
        )}
      </div>

      {estado === "Nuevo" && (
        <div className="flex gap-2 ml-4">
          <button onClick={onEdit} title="Editar">
            <Pencil className="w-4 h-4 text-gray-700" />
          </button>
          <button onClick={onDelete} title="Eliminar">
            <Trash2 className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      )}
      {estado === "Hecho" && (
        <button onClick={onToggleDone} title="Marcar como pendiente">
          <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
        </button>
      )}
    </div>
  )
}

