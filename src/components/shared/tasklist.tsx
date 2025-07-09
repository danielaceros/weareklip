"use client"

import TaskItem from "@/components/shared/taskitem"

type Task = {
  id: string
  descripcion: string
  estado: "Nuevo" | "Hecho"
  creadoEn: number
  fechaFin?: number
}

type Props = {
  tasks: Task[]
  onToggleDone: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

export default function TaskList({ tasks, onToggleDone, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          descripcion={task.descripcion}
          fechaFin={task.fechaFin}
          estado={task.estado}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onToggleDone={() => onToggleDone(task.id)}
        />
      ))}
    </div>
  )
}
