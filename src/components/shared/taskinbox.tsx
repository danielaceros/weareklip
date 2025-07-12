"use client"

import { useEffect, useState, useCallback } from "react"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import TaskList from "@/components/shared/tasklist"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Task = {
  id: string
  descripcion: string
  estado: "Nuevo" | "Hecho"
  creadoEn: number
  fechaFin?: number
}

type Props = {
  adminId: string
}

export default function TaskInbox({ adminId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "admin", adminId, "tasks"))
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[]
      setTasks(data.sort((a, b) => b.creadoEn - a.creadoEn))
    } catch {
      toast.error("Error al cargar tareas")
    }
  }, [adminId])

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newEstado = task.estado === "Hecho" ? "Nuevo" : "Hecho"
    try {
      await updateDoc(doc(db, "admin", adminId, "tasks", taskId), {
        estado: newEstado,
      })
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, estado: newEstado } : t
        )
      )
    } catch {
      toast.error("No se pudo actualizar la tarea")
    }
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return
    try {
      await deleteDoc(doc(db, "admin", adminId, "tasks", taskId))
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success("Tarea eliminada")
    } catch {
      toast.error("No se pudo eliminar la tarea")
    }
  }

  const saveEditedTask = async () => {
    if (!editingTask) return
    try {
      const { id, descripcion, fechaFin } = editingTask
      await updateDoc(doc(db, "admin", adminId, "tasks", id), {
        descripcion,
        fechaFin,
      })
      setTasks(prev =>
        prev.map(t =>
          t.id === id ? { ...t, descripcion, fechaFin } : t
        )
      )
      toast.success("Tarea actualizada")
      setEditingTask(null)
    } catch {
      toast.error("Error al guardar cambios")
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-bold">📥 Tareas Asignadas</h2>

          <TaskList
            tasks={tasks.filter(t => t.estado === "Nuevo")}
            onToggleDone={toggleTask}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer hover:underline">
              Mostrar tareas completadas
            </summary>
            <TaskList
              tasks={tasks.filter(t => t.estado === "Hecho")}
              onToggleDone={toggleTask}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </details>
        </CardContent>
      </Card>

      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Descripción"
              value={editingTask?.descripcion || ""}
              onChange={(e) =>
                setEditingTask((prev) =>
                  prev ? { ...prev, descripcion: e.target.value } : null
                )
              }
            />
            <Input
              type="date"
              value={
                editingTask?.fechaFin
                  ? new Date(editingTask.fechaFin).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setEditingTask((prev) =>
                  prev
                    ? { ...prev, fechaFin: new Date(e.target.value).getTime() }
                    : null
                )
              }
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                Cancelar
              </Button>
              <Button onClick={saveEditedTask}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
